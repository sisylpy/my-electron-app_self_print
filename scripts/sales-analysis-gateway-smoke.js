const assert = require('node:assert/strict');
const path = require('node:path');
const { createDispatchGateway } = require('../src/dispatch/dispatch-gateway');

async function run() {
  const requests = [];
  const axios = {
    create() {
      return {
        async request(config) {
          requests.push(config);
          if (config.url === 'desktop-dispatch/v1/auth/me') {
            return {
              status: 200,
              data: {
                code: 0,
                data: {
                  userId: 9,
                  disId: 160,
                  roleCode: 0,
                  permissions: ['analytics:sales:read'],
                },
              },
            };
          }
          return { status: 200, data: { code: 0, data: { accepted: true } } };
        },
      };
    },
  };
  const gateway = createDispatchGateway({
    app: {
      getPath: () => path.join(__dirname, '.sales-analysis-smoke-no-write'),
      getVersion: () => 'test',
    },
    safeStorage: { isEncryptionAvailable: () => false },
    axios,
  });
  const session = await gateway.adoptLoginSession({ accessToken: 'test-token' });
  assert.equal(session.ok, true);

  requests.length = 0;
  await gateway.loadSalesAnalysisCategoryCustomers({
    categoryId: 10,
    range: { startDate: '2026-09-01', endDate: '2026-09-30' },
    page: 2,
    pageSize: 20,
  });
  await gateway.loadSalesAnalysisCategoryCustomerProducts({
    categoryId: 10,
    customerId: 201,
    range: { startDate: '2026-09-01', endDate: '2026-09-30' },
    page: 3,
    pageSize: 20,
  });

  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].url, 'desktop-dispatch/v1/sales-analysis/categories/10/customers');
  assert.deepEqual(requests[0].params, {
    startDate: '2026-09-01', endDate: '2026-09-30', page: 2, pageSize: 20,
  });
  assert.equal(
    requests[1].url,
    'desktop-dispatch/v1/sales-analysis/categories/10/customers/201/products',
  );
  assert.equal(requests[1].params.page, 3);

  const requestCount = requests.length;
  const forbidden = await gateway.loadSalesAnalysisCategoryCustomers({
    categoryId: 10,
    range: { startDate: '2026-09-01', endDate: '2026-09-30' },
    page: 1,
    pageSize: 20,
    disId: 999,
  });
  const oversized = await gateway.loadSalesAnalysisCategoryCustomerProducts({
    categoryId: 10,
    customerId: 201,
    range: {},
    page: 1,
    pageSize: 101,
  });
  assert.equal(forbidden.ok, false);
  assert.equal(oversized.ok, false);
  assert.equal(requests.length, requestCount);

  console.log('sales analysis gateway smoke passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
