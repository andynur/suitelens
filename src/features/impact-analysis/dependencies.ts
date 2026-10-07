import { parse } from 'acorn';
import { z } from 'zod';
import { REFERENCE_LIMITS } from './references';

export const DEPENDENCY_LIMITS = { declarations: 20, modules: 200, moduleCharacters: 512 } as const;
export const ScriptDependenciesSchema = z.object({
  status: z.enum(['checked', 'not-checked']),
  reason: z.enum(['syntax', 'no-define', 'dynamic', 'limit']).optional(),
  declarations: z
    .array(
      z.object({
        line: z.number().int().positive(),
        modules: z
          .array(
            z.object({
              id: z.string().min(1).max(DEPENDENCY_LIMITS.moduleCharacters),
              line: z.number().int().positive(),
              column: z.number().int().positive(),
            }),
          )
          .max(DEPENDENCY_LIMITS.modules),
      }),
    )
    .max(DEPENDENCY_LIMITS.declarations),
});
export type ScriptDependencies = z.infer<typeof ScriptDependenciesSchema>;

/** Static top-level AMD declarations only. Never execute or resolve module paths. */
export function scanScriptDependencies(content: string): ScriptDependencies {
  const result: ScriptDependencies = { status: 'checked', declarations: [] };
  const incomplete = (reason: ScriptDependencies['reason']) => {
    result.status = 'not-checked';
    result.reason = reason;
    return result;
  };
  if (content.length > REFERENCE_LIMITS.characters) return incomplete('limit');
  try {
    const program = parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
    });
    for (const statement of program.body) {
      if (statement.type !== 'ExpressionStatement') continue;
      const call = statement.expression;
      if (
        call.type !== 'CallExpression' ||
        call.callee.type !== 'Identifier' ||
        call.callee.name !== 'define'
      )
        continue;
      if (result.declarations.length === DEPENDENCY_LIMITS.declarations) return incomplete('limit');
      const declaration = {
        line: call.loc!.start.line,
        modules: [] as ScriptDependencies['declarations'][number]['modules'],
      };
      result.declarations.push(declaration);
      const named =
        call.arguments[0]?.type === 'Literal' && typeof call.arguments[0].value === 'string';
      const args = call.arguments.slice(named ? 1 : 0);
      const array = args[0];
      if (
        args.length === 1 &&
        array &&
        ['FunctionExpression', 'ArrowFunctionExpression', 'ObjectExpression'].includes(array.type)
      )
        continue;
      if (args.length !== 2 || array?.type !== 'ArrayExpression') {
        incomplete('dynamic');
        continue;
      }
      for (const element of array.elements) {
        if (declaration.modules.length === DEPENDENCY_LIMITS.modules) return incomplete('limit');
        if (
          element?.type !== 'Literal' ||
          typeof element.value !== 'string' ||
          !element.value ||
          element.value.length > DEPENDENCY_LIMITS.moduleCharacters
        ) {
          incomplete('dynamic');
          continue;
        }
        declaration.modules.push({
          id: element.value,
          line: element.loc!.start.line,
          column: element.loc!.start.column + 1,
        });
      }
    }
    if (!result.declarations.length) return incomplete('no-define');
    return result;
  } catch {
    return incomplete('syntax');
  }
}
