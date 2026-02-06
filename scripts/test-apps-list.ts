
require('dotenv').config();
import { ApplicationController } from '../src/controllers/ApplicationController';
import { Request, Response } from 'express';

const COMPANY_ID = 'ead04834-f5c7-431c-8dfa-9a9143709b94'; // IPNET

// Mock Requisicao Express
function createMockReq(params: any = {}, body: any = {}, query: any = {}) {
    return {
        params,
        body,
        query,
        user: { id: 'ead04834-f5c7-431c-8dfa-9a9143709b94' } // IPNET's company ID is just used here as a placeholder UUID
    } as unknown as Request;
}

function createMockRes() {
    const res: any = {};
    res.json = (data: any) => {
        console.log('JSON Response (first app):', JSON.stringify(data[0], null, 2));
        return res;
    };
    res.status = (code: number) => {
        console.log('Status Code:', code);
        return res;
    };
    return res as Response;
}

async function main() {
    console.log('--- Testing Application Listing ---');
    const ctrl = new ApplicationController();

    await ctrl.list(createMockReq({}, {}, { company_id: COMPANY_ID }), createMockRes());
}

main();
