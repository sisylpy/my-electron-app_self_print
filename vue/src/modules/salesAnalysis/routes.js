export const SALES_ANALYSIS_ROUTE_NAME = 'SalesAnalysis';

export const salesAnalysisRoutes = [
  {
    path: '/sales-analysis',
    name: SALES_ANALYSIS_ROUTE_NAME,
    component: () => import('./views/SalesAnalysis.vue'),
    meta: {
      shell: true,
      module: 'salesAnalysis',
      navKey: 'sales-analysis',
      moduleLabel: '经营分析',
      title: '销售分析',
      description: '商品分布、客户结构与商品重要客户',
      requiresDisUser: true,
    },
  },
];

export default salesAnalysisRoutes;
