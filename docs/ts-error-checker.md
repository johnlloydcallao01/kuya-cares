TS Error Checker

Note that this is a monorepo platform.
Wherever app directory you are working on, make sure to run the following command to check for type errors:
1. pnpm exec tsc --noEmit
2. pnpm exec next lint

Make sure both above will have no errors or warnings. Fix all issues properly and professionally. You must not apply poor rushed loq quality temporary fix. ALWAYS FIX BOTH PROPERLY AND PROFESSIONALLY.

FINAL OUTPUT:

Must literally consequently run together where no errors or warnings (IMPORTANT!):

1. pnpm exec tsc --noEmit
2. pnpm exec next lint

Meaning, must be able to run both at the same time without any errors or warnings from both concurrently. 
If you don't do this, there might times that you will get errors or warnings from one of them caused by the solution you applied to one of the other. So the final goal is to run BOTH in a row without any errors or warnings.