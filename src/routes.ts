import { Router } from 'express';
import { AssessmentController } from './controllers/AssessmentController';
import { CompanyController } from './controllers/CompanyController';
import { requireAuth } from './middlewares/auth';

const routes = Router();
const assessmentController = new AssessmentController();
const companyController = new CompanyController();

// Protected routes
routes.use('/api/assessment', requireAuth);
routes.use('/api/companies', requireAuth);

routes.get('/api/assessment/questions', assessmentController.getQuestions);

// Company routes
routes.get('/api/companies', companyController.list);
routes.post('/api/companies', companyController.create);

export default routes;
