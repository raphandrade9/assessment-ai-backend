
require('dotenv').config();
import { CompanyController } from '../src/controllers/CompanyController';
import { Request, Response } from 'express';

const COMPANY_ID = 'ead04834-f5c7-431c-8dfa-9a9143709b94'; // IPNET

// Mock Requisicao Express
function createMockReq(params: any = {}, query: any = {}) {
    return {
        params,
        query,
        user: { id: 'mock-user' }
    } as unknown as Request;
}

function createMockRes() {
    const res: any = {};
    res.json = (data: any) => {
        console.log('JSON Response:', JSON.stringify(data, null, 2));
        return res;
    };
    res.status = (code: number) => {
        console.log('Status Code:', code);
        return res;
    };
    return res as Response;
}

async function main() {
    console.log('--- Testing Dashboard APIs ---\n');
    const controller = new CompanyController();

    console.log(`1. Testing GET /companies/${COMPANY_ID}/metrics`);
    await controller.getMetrics(
        createMockReq({ id: COMPANY_ID }),
        createMockRes()
    );

    console.log(`\n2. Testing GET /analytics/applications-by-status (Group by AREA)`);
    await controller.getApplicationsByStatus(
        createMockReq({ id: COMPANY_ID }, { group_by: 'area' }),
        createMockRes()
    );

    console.log(`\n3. Testing GET /analytics/applications-by-status (Group by SUB_AREA)`);
    await controller.getApplicationsByStatus(
        createMockReq({ id: COMPANY_ID }, { group_by: 'sub_area' }),
        createMockRes()
    );
}

main();
