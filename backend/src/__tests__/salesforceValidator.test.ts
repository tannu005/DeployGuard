import { SalesforceValidator } from '../validators/salesforceValidator';
import { Pipeline } from '../models/pipeline';

describe('SalesforceValidator', () => {
  let validator: SalesforceValidator;

  beforeEach(() => {
    validator = new SalesforceValidator();
  });

  test('should flag SFDX deploy without test level', () => {
    const pipeline: Pipeline = {
      jobs: [
        {
          name: 'deploy',
          steps: [
            { command: 'sfdx force:source:deploy --targetusername prod', line: 10 }
          ]
        }
      ]
    };

    const issues = validator.validate(pipeline);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('SF-001');
    expect(issues[0].severity).toBe('HIGH');
  });

  test('should pass SFDX deploy WITH test level', () => {
    const pipeline: Pipeline = {
      jobs: [
        {
          name: 'deploy',
          steps: [
            { command: 'sfdx force:source:deploy --test-level RunLocalTests', line: 10 }
          ]
        }
      ]
    };

    const issues = validator.validate(pipeline);
    expect(issues.length).toBe(0);
  });

  test('should flag hardcoded Connected App Client ID', () => {
    const pipeline: Pipeline = {
      jobs: [
        {
          name: 'auth',
          steps: [
            { command: 'sf org login jwt --clientid 3MVG9szVa2RxsqBXXXXXX --username me', line: 5 }
          ]
        }
      ]
    };

    const issues = validator.validate(pipeline);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('SF-002');
    expect(issues[0].severity).toBe('CRITICAL');
  });

  test('should pass dynamic Connected App Client ID', () => {
    const pipeline: Pipeline = {
      jobs: [
        {
          name: 'auth',
          steps: [
            { command: 'sf org login jwt --clientid ${{ secrets.SF_CLIENT_ID }} --username me', line: 5 }
          ]
        }
      ]
    };

    const issues = validator.validate(pipeline);
    expect(issues.length).toBe(0);
  });
});
