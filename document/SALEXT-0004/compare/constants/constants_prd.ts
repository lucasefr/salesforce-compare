/**
 * Shared constants for the Salesforce Compare extension.
 */
export const EXTENSION_ID = 'salesforceCompare';
export const ORG_SCHEME = 'salesforce-compare';
export const CONTEXT_IS_ELIGIBLE = 'salesforceCompare.isEligible';

export const COMMANDS = {
  diffWithOrg: 'salesforceCompare.diffWithOrg',
  recheckFile: 'salesforceCompare.recheckFile',
  showLastCheck: 'salesforceCompare.showLastCheck',
  clearCache: 'salesforceCompare.clearCache',
} as const;

export const DEFAULT_SUPPORTED_EXTENSIONS = [
  '.cls',
  '.trigger',
  '.js',
  '.html',
  '.css',
  '.xml',
  '.page',
  '.component',
  '.apex',
] as const;

/**
 * Companion `-meta.xml` suffixes that accompany a primary source file
 * (e.g. `MyClass.cls-meta.xml`). These are not standalone metadata and
 * should not be compared independently.
 */
// SALEXT-0003 - start
export const COMPANION_META_SUFFIXES = [
  '.cls-meta.xml',
  '.trigger-meta.xml',
  '.js-meta.xml',
  '.html-meta.xml',
  '.css-meta.xml',
  '.page-meta.xml',
  '.component-meta.xml',
  '.resource-meta.xml',
  '.cmp-meta.xml',
  '.evt-meta.xml',
  '.intf-meta.xml',
  '.tokens-meta.xml',
  '.auradoc-meta.xml',
  '.design-meta.xml',
  '.svg-meta.xml',
] as const;
// SALEXT-0003 - end

/** Salesforce default package directories used to detect eligible paths. */
export const SALESFORCE_PATH_MARKERS = [
  '/force-app/',
  '/main/default/',
  '\\force-app\\',
  '\\main\\default\\',
] as const;

/** Salesforce Extension Pack / CLI deploy command IDs (best-effort detection). */
export const SF_DEPLOY_COMMANDS = [
  'sfdx.force.source.deploy',
  'sfdx.force.source.deploy.current.source.file',
  'sfdx.force.source.deploy.selected.source',
  'sfdx.force.source.deploy.in.org',
  'sfdx.force.deploy.this.source.to.org',
  'sf.deploy.current.source.file',
  'sf.deploy.source.path',
  'sf.deploy.manifest',
  'sf.project.deploy.start',
  'force_source_deploy_with_sourcepath',
  'force_source_deploy_with_manifest',
] as const;

/** Salesforce Extension Pack / CLI retrieve command IDs (best-effort detection). */
export const SF_RETRIEVE_COMMANDS = [
  'sfdx.force.source.pull',
  'sfdx.force.source.retrieve',
  'sfdx.force.source.retrieve.source.path',
  'sfdx.force.source.retrieve.untilsource',
  'sfdx.force.source.retrieve.in.manifest',
  'sf.retrieve.current.source.file',
  'sf.retrieve.source.path',
  'sf.retrieve.manifest',
  'sf.project.retrieve.start',
  'force_source_retrieve_with_sourcepath',
  'force_source_retrieve_with_manifest',
] as const;
