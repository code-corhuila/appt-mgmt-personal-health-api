process.env.JWT_SECRET = 'test-secret';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../src/models/User', () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn()
}));
jest.mock('../src/config/database', () => ({
    getDatabaseStatus: jest.fn()
}));

const User = require('../src/models/User');
const { getDatabaseStatus } = require('../src/config/database');
const app = require('../src/app');

const USER_ID = '69187f000000000000000001';
const tokenFor = (userId = USER_ID) =>
    jwt.sign({ userId, email: 'ana@example.com' }, process.env.JWT_SECRET);
const authorization = (userId = USER_ID) => `Bearer ${tokenFor(userId)}`;

function makeUser(overrides = {}) {
    return {
        _id: new mongoose.Types.ObjectId(USER_ID),
        nombre: 'Ana Pérez',
        email: 'ana@example.com',
        telefono: '3001234567',
        contrasena: 'stored-hash',
        ...overrides
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    getDatabaseStatus.mockReturnValue('connected');
});

describe('health checks', () => {
    it('serves liveness without requiring MongoDB', async () => {
        const response = await request(app).get('/health/live');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'alive' });
    });

    it('reports MongoDB readiness', async () => {
        getDatabaseStatus.mockReturnValue('disconnected');

        const response = await request(app).get('/health/ready');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: 'degraded', database: 'disconnected' });
    });
});

describe('POST /api/auth/register', () => {
    it('normalizes email, hashes the password, and returns a Salud Activa-compatible response', async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockImplementation(async data => ({
            ...data,
            _id: new mongoose.Types.ObjectId(USER_ID)
        }));

        const response = await request(app)
            .post('/api/auth/register')
            .send({
                nombre: ' Ana Pérez ',
                email: ' ANA@EXAMPLE.COM ',
                telefono: ' 3001234567 ',
                contrasena: 'password123'
            });

        expect(response.status).toBe(201);
        expect(User.create).toHaveBeenCalledTimes(1);
        const createdUser = User.create.mock.calls[0][0];
        expect(createdUser).toMatchObject({
            nombre: 'Ana Pérez',
            email: 'ana@example.com',
            telefono: '3001234567'
        });
        expect(await bcrypt.compare('password123', createdUser.contrasena)).toBe(true);
        expect(response.body).toMatchObject({
            mensaje: 'OK',
            usuario: {
                id: USER_ID,
                _id: USER_ID,
                nombre: 'Ana Pérez',
                email: 'ana@example.com',
                telefono: '3001234567'
            }
        });
        expect(jwt.verify(response.body.token, process.env.JWT_SECRET).userId).toBe(USER_ID);
        expect(JSON.stringify(response.body)).not.toContain(createdUser.contrasena);
    });

    it('rejects invalid input and duplicate email without creating a user', async () => {
        const invalid = await request(app)
            .post('/api/auth/register')
            .send({ nombre: 'Ana', email: 'bad-email', contrasena: 'password123' });

        User.findOne.mockResolvedValue(makeUser());
        const duplicate = await request(app)
            .post('/api/auth/register')
            .send({ nombre: 'Ana', email: 'ana@example.com', contrasena: 'password123' });

        expect(invalid.status).toBe(400);
        expect(duplicate.status).toBe(409);
        expect(User.create).not.toHaveBeenCalled();
    });
});

describe('POST /api/auth/login', () => {
    it('accepts the mobile app email/contrasena contract and omits password data', async () => {
        const passwordHash = await bcrypt.hash('password123', 4);
        const user = makeUser({ contrasena: passwordHash });
        User.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(user)
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: ' ANA@EXAMPLE.COM ', contrasena: 'password123' });

        expect(response.status).toBe(200);
        expect(User.findOne).toHaveBeenCalledWith({ email: 'ana@example.com' });
        expect(response.body.usuario).toEqual({
            id: USER_ID,
            _id: USER_ID,
            nombre: 'Ana Pérez',
            email: 'ana@example.com',
            telefono: '3001234567'
        });
        expect(jwt.verify(response.body.token, process.env.JWT_SECRET).userId).toBe(USER_ID);
        expect(response.body).not.toHaveProperty('usuario.contrasena');
    });

    it('uses the same response for unknown users and incorrect passwords', async () => {
        User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'missing@example.com', contrasena: 'password123' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });
});

describe('authenticated profile endpoints', () => {
    it('requires a valid bearer JWT', async () => {
        const missing = await request(app).get('/api/auth/profile');
        const invalid = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', 'Bearer invalid');

        expect(missing.status).toBe(401);
        expect(invalid.status).toBe(401);
        expect(User.findById).not.toHaveBeenCalled();
    });

    it('returns only the caller profile from GET /api/auth/profile', async () => {
        User.findById.mockResolvedValue(makeUser());

        const response = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', authorization());

        expect(response.status).toBe(200);
        expect(User.findById).toHaveBeenCalledWith(USER_ID);
        expect(response.body).toEqual({
            id: USER_ID,
            _id: USER_ID,
            nombre: 'Ana Pérez',
            email: 'ana@example.com',
            telefono: '3001234567'
        });
        expect(response.body).not.toHaveProperty('contrasena');
    });

    it('updates only name and phone for the authenticated account', async () => {
        User.findById.mockResolvedValue(makeUser());
        User.findByIdAndUpdate.mockResolvedValue(makeUser({
            nombre: 'Ana María Pérez',
            telefono: '3015551234'
        }));

        const response = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', authorization())
            .send({
                nombre: ' Ana María Pérez ',
                telefono: ' 3015551234 ',
                email: 'attacker@example.com',
                contrasena: 'replacement-password',
                _id: '69187f000000000000000099'
            });

        expect(response.status).toBe(200);
        const [updatedId, update, options] = User.findByIdAndUpdate.mock.calls[0];
        expect(String(updatedId)).toBe(USER_ID);
        expect(update).toEqual({ $set: { nombre: 'Ana María Pérez', telefono: '3015551234' } });
        expect(options).toEqual({ new: true, runValidators: true });
        expect(response.body).toMatchObject({
            id: USER_ID,
            nombre: 'Ana María Pérez',
            email: 'ana@example.com',
            telefono: '3015551234'
        });
    });

    it('rejects blank names before updating', async () => {
        User.findById.mockResolvedValue(makeUser());

        const response = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', authorization())
            .send({ nombre: '   ', telefono: '' });

        expect(response.status).toBe(400);
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
});
