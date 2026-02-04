import { Router } from 'express';
import { AssessmentController } from './controllers/AssessmentController';
import { requireAuth } from './middlewares/auth';

const routes = Router();
const assessmentController = new AssessmentController();

// Protected routes
routes.use('/api/assessment', requireAuth);
routes.use('/api/companies', requireAuth);

routes.get('/api/assessment/questions', assessmentController.getQuestions);

export default routes;
