# Test Verification Guide

This document explains how to verify the tests work locally before the branch protection rule gates PR merging.

## 🧪 Local Test Verification

### Step 1: Install Dependencies

```bash
cd roon-extension-ikea-tradfri
npm install
```

This will install:
- Jest (test runner)
- ESLint (linter)
- All production dependencies

### Step 2: Run the Tests

```bash
# Run all tests
npm test

# Run tests with watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Step 3: Expected Output

You should see output similar to:

```
 PASS  __tests__/state.test.js
 PASS  __tests__/settings-manager.test.js
 PASS  __tests__/tradfri-manager.test.js
 PASS  __tests__/connection.test.js

Test Suites: 4 passed, 4 total
Tests:       20+ passed, 20+ total
Snapshots:   0 total
Time:        X.XXs
```

### Step 4: Check Linting

```bash
npm run lint
```

All linting should pass without errors.

## 📋 Test Coverage

The tests cover:

### state.test.js
- ✅ State initialization
- ✅ getState() returns current state
- ✅ getState() returns a copy, not reference
- ✅ getStateValue() for valid and invalid keys
- ✅ setStateValue() updates state
- ✅ updateState() updates multiple values
- ✅ getSettings() returns settings
- ✅ updateSettings() updates settings
- ✅ resetState() restores initial values
- ✅ Constants are exported correctly

### settings-manager.test.js
- ✅ makeLayout() returns valid layout object
- ✅ Shows security code input on first run
- ✅ Shows authentication failed message
- ✅ Shows zone and device dropdown when configured
- ✅ Shows message when no devices available
- ✅ Handles errors gracefully

### tradfri-manager.test.js
- ✅ cleanupTradfriConnection() does nothing when tradfri is null
- ✅ cleanupTradfriConnection() cleans up when tradfri exists
- ✅ cleanupTradfriConnection() handles errors gracefully
- ✅ stopGatewayMonitor() clears timer
- ✅ stopGatewayMonitor() does nothing when timer is null
- ✅ turnIkeaDevice() does nothing when not connected
- ✅ turnIkeaDevice() turns on device when found
- ✅ turnIkeaDevice() turns off device when found
- ✅ turnIkeaDevice() does nothing when device not found

### connection.test.js
- ✅ Throws error when gateway not found
- ✅ Throws error when gateway discovery fails
- ✅ Attempts connection with cached credentials
- ✅ Uses security code when no cached credentials
- ✅ Returns false when no valid credentials available

## 🔧 Troubleshooting

### If tests fail with "Cannot use import statement outside a module"

This means Jest isn't configured for ES modules. Try:

```bash
# Option 1: Update Jest config
npm install --save-dev @babel/core @babel/preset-env babel-jest

# Then update jest.config.js to use babel
```

Or use this babel.config.js:
```javascript
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
```

### If tests fail with mocking issues

The tests use `jest.mock()` which should work with ES modules in Jest 29+. If you see mocking errors, try:

```bash
# Clear Jest cache
npx jest --clearCache
```

### If you need to skip tests temporarily

Add `.skip` to the describe or it blocks:
```javascript
describe.skip('Connection', () => { ... })
```

## ✅ CI/CD Integration

Once tests pass locally, the GitHub Actions workflow will:

1. Run `npm run lint` (must pass)
2. Run `npm test` (must pass)
3. Build Docker image (only if tests pass)

The branch protection rule requires the "CI" workflow to pass before merging to main.

## 📊 Current Status

- ✅ Test files created
- ✅ CI workflow updated to run tests
- ✅ Branch protection rule configured (by you)
- ⏳ Tests need to be verified locally

Once you confirm tests pass locally, the PR will be gated by the CI tests automatically.
