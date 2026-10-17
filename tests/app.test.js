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
  it('keeps the stall dashboard behind login', async () => {
    const res = await request(app).get('/dashboard/menu');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
  it('rejects a POST without a CSRF token', async () => {
    const res = await request(app).post('/login').type('form').send({ login: 'x', password: 'y' });
    expect(res.status).toBe(403);
  });
  it('shows the stall registration form', async () => {
    const res = await request(app).get('/register/stall');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Stall name');
  });
  it('login page switches between student and stall owner', async () => {
    const student = await request(app).get('/login');
    expect(student.text).toContain('Student number');
    const stall = await request(app).get('/login?as=stall');
    expect(stall.text).toContain('Stall e-mail');
    expect(stall.text).toContain('Stall owner');
  });
  it('landing page loads even if the database is down', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Skip the line');
  });
  it('returns 404 for a malformed stall id', async () => {
    const res = await request(app).get('/stalls/abc');
    expect(res.status).toBe(404);
  });
  it('returns 404 for unknown pages', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
