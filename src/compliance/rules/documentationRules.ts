import type { Gate } from '../types.ts';

export type DocumentationInput = {
  /** Contents of the README.md file, or undefined if not found */
  readmeContent?: string;
  /** Whether docs/vapor-compliance.md exists */
  vaporComplianceDocExists?: boolean;
};

const WORKBENCH_TEXT = 'Vapor UI Compliance Workbench';

/**
 * Checks documentation requirements:
 * 1. README.md must contain "Vapor UI Compliance Workbench"
 * 2. docs/vapor-compliance.md must exist
 */
export function checkDocumentation(input: DocumentationInput): Gate {
  const gateId = 'documentation';
  const name = 'Documentation';

  const evidence = [];
  const fixGuide = [];

  const readmeMentionsWorkbench = input.readmeContent?.includes(WORKBENCH_TEXT) ?? false;
  const docExists = input.vaporComplianceDocExists ?? false;

  if (!input.readmeContent) {
    evidence.push({
      message: 'README.md not found or empty.',
      location: 'README.md',
    });
    fixGuide.push({
      title: 'Create README.md',
      detail: `Add a README.md that mentions "${WORKBENCH_TEXT}".`,
    });
  } else if (!readmeMentionsWorkbench) {
    evidence.push({
      message: `README.md does not contain "${WORKBENCH_TEXT}".`,
      location: 'README.md',
    });
    fixGuide.push({
      title: `Add "${WORKBENCH_TEXT}" to README.md`,
      detail: `Update README.md to describe the Vapor UI Compliance Workbench purpose and usage.`,
    });
  } else {
    evidence.push({
      message: `README.md contains "${WORKBENCH_TEXT}".`,
      location: 'README.md',
    });
  }

  if (!docExists) {
    evidence.push({
      message: 'docs/vapor-compliance.md does not exist.',
      location: 'docs/vapor-compliance.md',
    });
    fixGuide.push({
      title: 'Create docs/vapor-compliance.md',
      detail: 'Add docs/vapor-compliance.md documenting compliance gates, scoring, and how to fix violations.',
    });
  } else {
    evidence.push({
      message: 'docs/vapor-compliance.md exists.',
      location: 'docs/vapor-compliance.md',
    });
  }

  const hasFail = !readmeMentionsWorkbench || !docExists;

  return {
    gateId,
    name,
    status: hasFail ? 'FAIL' : 'PASS',
    evidence,
    fixGuide,
  };
}
