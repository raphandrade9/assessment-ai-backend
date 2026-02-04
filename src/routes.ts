import { Router } from 'express';
import { AssessmentController } from './controllers/AssessmentController';

const routes = Router();
const assessmentController = new AssessmentController();

routes.get('/api/assessment/questions', assessmentController.getQuestions);

export default routes;
