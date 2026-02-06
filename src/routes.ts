import { Router } from 'express';
import { AssessmentController } from './controllers/AssessmentController';
import { CompanyController } from './controllers/CompanyController';
import { ApplicationController } from './controllers/ApplicationController';
import { PeopleController } from './controllers/PeopleController';
import { ReferenceController } from './controllers/ReferenceController';
import { requireAuth } from './middlewares/auth';
import { BusinessAreaController } from './controllers/BusinessAreaController';

const routes = Router();
const assessmentController = new AssessmentController();
const companyController = new CompanyController();
const applicationController = new ApplicationController();
const peopleController = new PeopleController();
const referenceController = new ReferenceController();
const businessAreaController = new BusinessAreaController();

// Protected routes
routes.use('/api/assessment', requireAuth);
routes.use('/api/companies', requireAuth);
routes.use('/api/applications', requireAuth);
routes.use('/api/references', requireAuth);
routes.use('/api/areas', requireAuth);
routes.use('/api/sub-areas', requireAuth);

routes.get('/api/assessment/questions', assessmentController.getQuestions);
routes.get('/api/assessment/:id', assessmentController.getById);
routes.post('/api/assessment/init', assessmentController.init);
routes.put('/api/assessment/:id/answers', assessmentController.saveAnswer);
routes.post('/api/assessment/:id/finalize', assessmentController.finalize);

// Company routes
routes.get('/api/companies', companyController.list);
routes.post('/api/companies', companyController.create);
routes.get('/api/companies/:id/metrics', companyController.getMetrics);
routes.get('/api/companies/:id/metrics/areas', companyController.getMetricsByArea);
routes.get('/api/companies/:id/metrics/areas/:areaId/sub-areas', companyController.getMetricsBySubArea);
routes.get('/api/companies/:id/analytics/applications-by-status', companyController.getApplicationsByStatus);

// People routes
routes.get('/api/companies/:companyId/people', peopleController.listByCompany);
routes.post('/api/companies/:companyId/people', peopleController.create);
routes.patch('/api/companies/:companyId/people/:personId', peopleController.update);

// Business Areas Routes
routes.get('/api/companies/:companyId/areas', businessAreaController.listByCompany);
routes.post('/api/companies/:companyId/areas', businessAreaController.createArea);
routes.patch('/api/areas/:id', businessAreaController.updateArea);
routes.delete('/api/areas/:id', businessAreaController.deleteArea);

// Sub-Areas Routes
routes.post('/api/areas/:areaId/sub-areas', businessAreaController.createSubArea);
routes.patch('/api/sub-areas/:id', businessAreaController.updateSubArea);
routes.delete('/api/sub-areas/:id', businessAreaController.deleteSubArea);

// Reference routes
routes.get('/api/references/archetypes', referenceController.getArchetypes);
routes.get('/api/references/technical-levels', referenceController.getTechnicalLevels);
routes.get('/api/references/business-levels', referenceController.getBusinessLevels);

// Application routes
routes.get('/api/applications', applicationController.list);
routes.post('/api/applications', applicationController.create);

export default routes;
