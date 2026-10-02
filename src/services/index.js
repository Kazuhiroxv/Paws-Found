/**
 * Service layer barrel.
 *
 * Import services from here so call sites read as `petService.getReports()`:
 *
 *   import { petService } from '@/services'
 *   const reports = await petService.getRecentReports(6)
 *
 * This is the seam between the UI and the data source. Everything below it
 * calls the PHP API; everything above it should not care.
 */

import * as petService from './petService'
import * as userService from './userService'
import * as matchService from './matchService'
import * as notificationService from './notificationService'
import * as moderationService from './moderationService'
import * as categoryService from './categoryService'
import * as referenceService from './referenceService'

export {
  petService,
  userService,
  matchService,
  notificationService,
  moderationService,
  categoryService,
  referenceService,
}
export { NotFoundError } from './errors'
