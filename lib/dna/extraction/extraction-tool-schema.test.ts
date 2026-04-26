import { EXTRACTION_FUNCTION_DECLARATION, EXTRACTION_TOOL } from './extraction-tool-schema';

describe('EXTRACTION_FUNCTION_DECLARATION', () => {
  it('has name "update_master_profile"', () => {
    expect(EXTRACTION_FUNCTION_DECLARATION.name).toBe('update_master_profile');
  });

  it('has parameters.properties.progress_assessment with required has_actionable_pattern and depth_score', () => {
    const params = EXTRACTION_FUNCTION_DECLARATION.parameters!;
    const properties = params.properties!;
    const progressAssessment = properties['progress_assessment'] as unknown as { required: string[] };
    expect(progressAssessment).toBeDefined();
    expect(progressAssessment.required).toContain('has_actionable_pattern');
    expect(progressAssessment.required).toContain('depth_score');
  });

  it('does NOT have themes_extracted in function parameters', () => {
    const params = EXTRACTION_FUNCTION_DECLARATION.parameters!;
    const properties = params.properties!;
    const paramKeys = Object.keys(properties);
    expect(paramKeys).not.toContain('themes_extracted');
  });
});

describe('EXTRACTION_TOOL', () => {
  it('wraps the declaration in { functionDeclarations: [...] }', () => {
    expect(EXTRACTION_TOOL).toHaveProperty('functionDeclarations');
    const funcs = EXTRACTION_TOOL.functionDeclarations!;
    expect(Array.isArray(funcs)).toBe(true);
    expect(funcs.length).toBe(1);
    expect(funcs[0]).toBe(EXTRACTION_FUNCTION_DECLARATION);
  });
});
