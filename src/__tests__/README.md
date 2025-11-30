# DukeFarm Backend - Unit Tests

## Overview
This directory contains unit tests for the DukeFarm backend services.

## Setup

### Install Dependencies
```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### Configuration Files
- `jest.config.js` - Jest configuration
- `src/__tests__/setup.ts` - Test setup and global configuration

## Running Tests

### Run all tests
```bash
npm test
```

### Watch mode (auto-rerun on file changes)
```bash
npm run test:watch
```

### Coverage report
```bash
npm run test:coverage
```

## Test Structure

```
src/__tests__/
├── setup.ts              # Test configuration
├── utils/
│   ├── jwt.test.ts       # JWT signing/verification tests
│   └── crypto.test.ts    # Password hashing tests
└── services/
    ├── health.test.ts            # Health check service tests
    └── feeding-calculator.test.ts # Feeding algorithm tests
```

## Test Coverage

### Current Coverage
- **JWT Utils**: 100% - Token signing, verification, error handling
- **Crypto Utils**: 100% - SHA-256 password hashing
- **Health Service**: 100% - Health check endpoint
- **Feeding Calculator**: 95% - Temperature-based feed adjustment algorithm

### Coverage Thresholds
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Writing Tests

### Best Practices
1. **Descriptive names**: Use clear test descriptions
2. **AAA Pattern**: Arrange, Act, Assert
3. **Isolation**: Each test should be independent
4. **Edge cases**: Test boundary conditions
5. **Mocking**: Mock external dependencies (DB, APIs)

### Example Test
```typescript
describe('MyService', () => {
  describe('myFunction', () => {
    it('should return expected value for valid input', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = MyService.myFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Key Test Cases

### JWT Utils (`jwt.test.ts`)
- ✅ Token signing with valid payload
- ✅ Token verification and decoding
- ✅ Invalid token rejection
- ✅ Tampered token detection
- ✅ Custom options support
- ✅ No-expiration tokens

### Feeding Calculator (`feeding-calculator.test.ts`)
- ✅ Optimal zone (28-35°C) → 0% adjustment
- ✅ Cold zone (<28°C) → Progressive reduction
- ✅ Hot zone (>35°C) → Progressive reduction
- ✅ Null temperature handling
- ✅ 7-day forecast generation
- ✅ Temperature variance simulation
- ✅ Seasonal scenarios (cool, hot, optimal)

### Crypto Utils (`crypto.test.ts`)
- ✅ SHA-256 hash generation
- ✅ Consistent hashing
- ✅ Different inputs → different hashes
- ✅ Special characters support
- ✅ Unicode support
- ✅ Case sensitivity
- ✅ Known hash verification

### Health Service (`health.test.ts`)
- ✅ Health status response
- ✅ Timestamp format validation
- ✅ Uptime calculation
- ✅ Environment detection

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
**Solution**: Run `npm install` and `npx prisma generate`

**Issue**: JWT tests fail
**Solution**: Ensure `JWT_SECRET` is set in test environment

**Issue**: Timeout errors
**Solution**: Increase Jest timeout in `jest.config.js`

## Next Steps

### Future Test Coverage
- [ ] Integration tests with Prisma (mock database)
- [ ] API endpoint tests with supertest
- [ ] LINE Auth service tests (mock LINE API)
- [ ] Weather service tests (mock Open-Meteo API)
- [ ] Middleware tests (auth, error handling)
- [ ] Controller tests (request/response handling)

## Resources
- [Jest Documentation](https://jestjs.io/)
- [ts-jest Guide](https://kulshekhar.github.io/ts-jest/)
- [Supertest API Testing](https://github.com/visionmedia/supertest)
