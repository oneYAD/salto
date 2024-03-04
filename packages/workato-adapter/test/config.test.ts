/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import {
  API_DEFINITIONS_CONFIG,
  SUPPORT_DEPLOY_FLAG,
  getDefaultConfig,
  getDefaultTypes,
  } from '../src/config'

describe('config', () => {
  describe('getDefaultConfig', () => {
    describe('without deploy support', () => {
      it('should include extended_schema in fieldToOmit', () => {
        const config = getDefaultConfig(false)
        expect(config[SUPPORT_DEPLOY_FLAG]).toBe(false)
        expect(config[API_DEFINITIONS_CONFIG].types.recipe.transformation?.fieldsToOmit).toBeDefined()
        expect(config[API_DEFINITIONS_CONFIG].types.recipe.transformation?.fieldsToOmit).toContainEqual({'fieldName': 'extended_input_schema'})
        expect(config[API_DEFINITIONS_CONFIG].types.recipe.transformation?.fieldsToOmit).toContainEqual({'fieldName': 'extended_output_schema'})
      })
    })
    describe('with deploy support', () => {
      it('should add flag and not include extended_schemas in fieldToOmit', () => {
        const config = getDefaultConfig(true)
        expect(config[SUPPORT_DEPLOY_FLAG]).toBe(true)
        expect(config[API_DEFINITIONS_CONFIG].types.recipe.transformation?.fieldsToOmit).toBeDefined()
        expect(config[API_DEFINITIONS_CONFIG].types.recipe.transformation?.fieldsToOmit).not.toContainEqual({'fieldName': 'extended_input_schema'})
        expect(config[API_DEFINITIONS_CONFIG].types.recipe.transformation?.fieldsToOmit).not.toContainEqual({'fieldName': 'extended_output_schema'})
      })
    })
  })

  describe('getDefaultTypes', () => {
    describe('without deploy support', () => {
      it('should include extended_schema in fieldToOmit', () => {
        const types = getDefaultTypes(false)
        expect(types.recipe.transformation?.fieldsToOmit).toBeDefined()
        expect(types.recipe.transformation?.fieldsToOmit).toContainEqual({'fieldName': 'extended_input_schema'})
        expect(types.recipe.transformation?.fieldsToOmit).toContainEqual({'fieldName': 'extended_output_schema'})
      })
    })
    describe('with deploy support', () => {
      it('should not include extended_schemas in fieldToOmit', () => {
        const types = getDefaultTypes(true)
        expect(types.recipe.transformation?.fieldsToOmit).toBeDefined()
        expect(types.recipe.transformation?.fieldsToOmit).not.toContainEqual({'fieldName': 'extended_input_schema'})
        expect(types.recipe.transformation?.fieldsToOmit).not.toContainEqual({'fieldName': 'extended_output_schema'})
      })
    })
  })
})
