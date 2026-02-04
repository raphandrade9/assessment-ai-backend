import { Router } from 'express';
import { AssessmentController } from './controllers/AssessmentController';
import { CompanyController } from './controllers/CompanyController';
import { ApplicationController } from './controllers/ApplicationController';
import { requireAuth } from './middlewares/auth';

const routes = Router();
const assessmentController = new AssessmentController();
const companyController = new CompanyController();
const applicationController = new ApplicationController();

// Protected routes
routes.use('/api/assessment', requireAuth);
routes.use('/api/companies', requireAuth);
routes.use('/api/applications', requireAuth);

routes.get('/api/assessment/questions', assessmentController.getQuestions);
routes.post('/api/assessment/init', assessmentController.init);
routes.put('/api/assessment/:id/answers', assessmentController.saveAnswer);
routes.post('/api/assessment/:id/finalize', assessmentController.finalize);

// Company routes
routes.get('/api/companies', companyController.list);
routes.post('/api/companies', companyController.create);

// Application routes
routes.get('/api/applications', applicationController.list);
routes.post('/api/applications', applicationController.create);

export default routes;
