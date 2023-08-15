/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  InstanceElement, isInstanceElement, ReferenceExpression,
  ElemID, Values,
} from '@salto-io/adapter-api'
import { DependencyDirection } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { addReferencesForService, FormulaReferenceFinder, MappedReference, ReferenceFinder, getBlockDependencyDirection, createMatcher, Matcher } from '../reference_finders'
import { ZendeskIndex } from './element_index'
import { isZendeskBlock, ZendeskBlock } from './recipe_block_types'

const { isDefined } = lowerdashValues
const ID_FIELD_REGEX = /^field_(\d+)$/ // pattern: field_<number>
const KEY_FIELD_REGEX = /^field_([^\s]+)$/ // pattern: field_<string>

type ZendeskFieldMatchGroup = { custom?: string; field: string; block: string }

type pasten = {
  indexKey: Record<string | number, Readonly<InstanceElement>>
  indexValue: Record<string | number, Record<string, Readonly<InstanceElement>>>
  regex?: RegExp
  fieldKeyConverter?: (match: string) => string | number
}

const isZendeskFieldMatchGroup = (val: Values): val is ZendeskFieldMatchGroup => (
  (val.custom === undefined || _.isString(val.custom))
  && _.isString(val.field)
  && _.isString(val.block)
)

const createFormulaFieldMatcher = (application: string): Matcher<ZendeskFieldMatchGroup> => {
  // example: ('data.zendesk.1234abcd.priority')
  const ticketStandardFieldMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.(?<field>\\w+)'\\)`, 'g')

  // example: ('data.zendesk.1234abcd.custom_field.field_6092682303763')
  // example: ('data.zendesk.1234abcd.organization_fields.field_age')
  // example: ('data.zendesk.1234abcd.user_field.field_userfield1')
  // example: ('data.zendesk.1234abcd.users.first.user_field.field_userfield1')
  // example: ('data.zendesk.1234abcd.get_user_by_id(requester_id>id).user_field.field_userfield1')
  // example: ('data.zendesk.1234abcd.get_organization_by_id(organization_id>id).organization_fields.field_age')
  const customFieldMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.[^\\']*?\\.(?<custom>\\w+)_fields\\.field_(?<field>\\w+)[^\\']*?'\\)`, 'g')

  return createMatcher(
    [
      ticketStandardFieldMatcher,
      customFieldMatcher,
    ],
    isZendeskFieldMatchGroup,
  )
}

const getFieldReference = (
  fieldName: string | number,
  index: Record<string | number, Readonly<InstanceElement>>,
  path: ElemID
) : MappedReference | undefined => {
  if (fieldName === undefined || !isInstanceElement(index[fieldName])) {
    return undefined
  }

  return {
    location: new ReferenceExpression(path),
    // references inside formulas are always used as input
    direction: 'input' as DependencyDirection,
    reference: new ReferenceExpression(index[fieldName].elemID),
  }
}

export const addZendeskRecipeReferences = async (
  inst: InstanceElement,
  indexedElements: ZendeskIndex,
  appName: string,
): Promise<void> => {
  const references: MappedReference[] = []
  const actionBlock: Record<string, 'ticket' | 'user' | 'organization' | 'other'> = {}

  const referenceFinder: ReferenceFinder<ZendeskBlock> = (blockValue, path) => {
    const { input, name } = blockValue

    const direction = getBlockDependencyDirection(blockValue)
    const inputFieldKeys = Object.keys(input)
    actionBlock[blockValue.as] = 'other'

    const addPotentialIdReference = (
      valueInst: unknown, nestedPath : ElemID | undefined = undefined,
    ): boolean => {
      if (isInstanceElement(valueInst)) {
        references.push(
          {
            pathToOverride: nestedPath,
            location: new ReferenceExpression(path),
            direction,
            reference: new ReferenceExpression(valueInst.elemID, valueInst),
          },
        )
        return true
      }
      return false
    }

    const addFieldsReferences = (
      { indexKey, indexValue, regex = KEY_FIELD_REGEX, fieldKeyConverter = match => match } : pasten
    ) : void => {
      inputFieldKeys.forEach(field => {
        const match = field.match(regex)
        if (match === null || match.length < 2) {
          return
        }

        const fieldKey = fieldKeyConverter(match[1])
        if (!_.isNaN(fieldKey) && addPotentialIdReference(
          indexKey[fieldKey]
          // no pathToOverride because we can't override the field keys in the current format
        )) {
          const optionsByValue = indexValue[fieldKey]
          if (optionsByValue !== undefined && input[field] !== undefined) {
            addPotentialIdReference(
              optionsByValue[input[field]],
              path.createNestedID('input', field),
            )
          }
        }
      })
    }

    if (input.macro_ids !== undefined && input.macro_ids.id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.macros[input.macro_ids.id],
        path.createNestedID('input', 'macro_ids', 'id')
      )
    }

    if (input.group_id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.groups[input.group_id],
        path.createNestedID('input', 'group_id')
      )
    }

    if (input.brand_id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.brands[input.brand_id],
        path.createNestedID('input', 'brand_id')
      )
    }

    if (input.ticket_form_id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.ticketForms[input.ticket_form_id],
        path.createNestedID('input', 'ticket_form_id')
      )
    }

    if (name.includes('ticket')) { // TODO change to specific list of blocks
      actionBlock[blockValue.as] = 'ticket'
      Object.keys(indexedElements.standardTicketFieldByName).forEach(fieldName => {
        if (input[fieldName] !== undefined) {
          addPotentialIdReference(
            indexedElements.standardTicketFieldByName[fieldName]
            // no pathToOverride because we can't override the field keys in the current format
          )
        }
      })
      addFieldsReferences({
        indexKey: indexedElements.elementsByInternalID.ticketFields,
        indexValue: indexedElements.ticketCustomOptionByFieldIdAndValue,
        regex: ID_FIELD_REGEX,
        fieldKeyConverter: match => Number(match),
      })
    } else if (name.includes('user')) { // TODO change to specific list of blocks
      actionBlock[blockValue.as] = 'user'
      addFieldsReferences({
        indexKey: indexedElements.customFieldsByKey.user,
        indexValue: indexedElements.customOptionsByFieldKeyAndValue.user,
      })
    } else if (name.includes('organization')) { // TODO change to specific list of blocks
      actionBlock[blockValue.as] = 'organization'
      addFieldsReferences({
        indexKey: indexedElements.customFieldsByKey.organization,
        indexValue: indexedElements.customOptionsByFieldKeyAndValue.organization,
      })
    }

    return references
  }

  const formulaFieldMatcher = createFormulaFieldMatcher(appName)

  const formulaReferenceFinder: FormulaReferenceFinder = (value, path) => {
    const potentialMatchGroups = formulaFieldMatcher(value)
    return potentialMatchGroups.map(({ block, custom, field: fieldName }) => {
      if (!Object.keys(actionBlock).includes(block)) {
        // we check that block is defined to make sure this block has the right application
        return undefined
      }

      if (custom !== undefined) {
        if (custom === 'custom') { // === 'ticket'. there is no ticket_fields only custom_fields
          const fieldId = Number(fieldName)
          return !_.isNaN(fieldId)
            ? getFieldReference(fieldId, indexedElements.elementsByInternalID.ticketFields, path)
            : undefined
        }

        if (custom === 'user') {
          return getFieldReference(fieldName, indexedElements.customFieldsByKey.user, path)
        }

        if (custom === 'organization') {
          return getFieldReference(fieldName, indexedElements.customFieldsByKey.organization, path)
        }
        return undefined
      }

      if (actionBlock[block] === 'ticket' && indexedElements.standardTicketFieldByName[fieldName] !== undefined) {
        return {
          location: new ReferenceExpression(path),
          // references inside formulas are always used as input
          direction: 'input' as DependencyDirection,
          reference: new ReferenceExpression(indexedElements.standardTicketFieldByName[fieldName].elemID),
        }
      }
      return undefined
    }).filter(isDefined)
  }

  return addReferencesForService<ZendeskBlock>(
    inst,
    appName,
    isZendeskBlock,
    referenceFinder,
    formulaReferenceFinder,
  )
}
