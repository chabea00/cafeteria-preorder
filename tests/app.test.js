import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('app basics (no database needed)', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
  it('redirects anonymous users from /orders to /login', async () => {
    const res = await request(app).get('/orders');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
  it('rejects a POST without a CSRF token', async () => {
    const res = await request(app).post('/login').type('form').send({ student_no: 'x', password: 'y' });
    expect(res.status).toBe(403);
  });
  it('landing page loads even if the database is down', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Skip the line');
  });
  it('returns 404 for unknown pages', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});