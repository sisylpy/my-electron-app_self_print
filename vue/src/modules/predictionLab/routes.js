export const PREDICTION_LAB_ROUTE_NAME = 'PurchasePredictionLab';

export const predictionLabRoutes = [
  {
    path: '/prediction-lab',
    name: PREDICTION_LAB_ROUTE_NAME,
    component: () => import('./views/PredictionLab.vue'),
    meta: {
      shell: true,
      module: 'predictionLab',
      navKey: 'prediction-lab',
      moduleLabel: '智能备货',
      title: '智能备货',
      description: '按商品大类查看高可信与待确认备货需求',
      requiresDisUser: true,
    },
  },
];

export default predictionLabRoutes;
