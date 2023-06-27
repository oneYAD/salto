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
// eslint-disable-next-line import/no-extraneous-dependencies
import Joi from 'joi'
import { Value } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
// import { CROSS_SERVICE_SUPPORTED_APPS } from '../../../constants'
import { BlockBase } from '../recipe_block_types'

export type ZendeskBlock = BlockBase & {
  as: string
  provider: 'zendesk' | 'zendesk_secondary'
  name: string
  input: {
    [key: string]: Value
  }
}

const ZENDESK_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().required(),
  name: Joi.string().required(),
  input: Joi.object().required(),
}).unknown(true).required()

export const isZendeskBlock = createSchemeGuard<ZendeskBlock>(ZENDESK_BLOCK_SCHEMA)

// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// export const isZendeskBlock = (value: any, application: string): value is ZendeskBlock => (
//   _.isObjectLike(value)
//   && CROSS_SERVICE_SUPPORTED_APPS.zendesk.includes(application)
//   && value.provider === application
//   && _.isString(value.keyword)
//   && _.isObjectLike(value.input)
//   && _.isString(value.as)
//   && _.isString(value.name)
// )
