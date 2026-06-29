
const request = require('supertest');
const app = require('./app');

var eventId; // Variable globale pour stocker l'ID de l'événement créé
// test ok haha
describe('API Events', () => {
    it('should validate API password from secret', () => {
        expect(process.env.API_PASSWORD).toBeDefined();
        expect(process.env.API_PASSWORD).toBe('JeSuisUnMotDePasse');
    });
    // Tests pour POST /events
    it("should create an event with all valid fields", async () => {
        var today = new Date();
        const response = await request(app).post('/events')
            .send({ title: 'Complete Event', date: today.toISOString().split('T')[0], participants: 10, categorie: 'Music', lieu: 'Paris' });
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe('Complete Event');
        expect(response.body.date).toBe(today.toISOString().split('T')[0]);
        eventId = response.body.id; // Stocker l'ID de l'événement créé
    });
    it('should not create an event with missing title', async () => {
        var today = new Date();
        const response = await request(app)
            .post('/events')
            .send({ date: today.toISOString().split('T')[0], categorie: 'Music', participants: 10, lieu: 'Paris' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    it('should not create an event with a past date', async () => {
        var today = new Date();
        today.setDate(today.getDate() - 1);
        const response = await request(app)
            .post('/events')
            .send({ title: 'Past Event', date: today.toISOString().split('T')[0], categorie: 'Music', participants: 10, lieu: 'Paris' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    it('should retrieve all events', async () => {
        const response = await request(app).get('/events');
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('should update an existing event', async () => {
        var today = new Date();
        const updateResponse = await request(app)
            .put("/events/" + eventId)
            .send({ title: 'Updated Event', date: today.toISOString().split('T')[0] });
        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.title).toBe('Updated Event');
    });

    it('should not update an existing event because of anterior date', async () => {
        var today = new Date();
        var pastDate = new Date();
        pastDate.setDate(today.getDate() - 1);
        const updateResponse = await request(app)
            .put("/events/" + eventId)
            .send({ title: 'Updated Event', date: pastDate.toISOString().split('T')[0] });
        expect(updateResponse.statusCode).toBe(400);
        expect(updateResponse.body).toHaveProperty('error');
    });

    it("should not create when more than 50 participants", async () => {
        var today = new Date();
        const response = await request(app)
            .post('/events')
            .send({ title: 'Big Event', date: today.toISOString().split('T')[0], participants: 51, categorie: 'Music', lieu: 'Paris' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
    it("should not create when no category is provided", async () => {
        var today = new Date();
        const response = await request(app)
            .post('/events')
            .send({ title: 'Weird Event', date: today.toISOString().split('T')[0], participants: 10, lieu: 'Paris' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
    it("should not create when weird category is provided", async () => {
        var today = new Date();
        const response = await request(app)
            .post('/events')
            .send({ title: 'Weird Event', date: today.toISOString().split('T')[0], participants: 10, lieu: 'Paris', categorie: 'Weird' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
    it("should not create when no location is provided", async () => {
        var today = new Date();
        const response = await request(app).post('/events')
            .send({ title: 'Locationless Event', date: today.toISOString().split('T')[0], participants: 10, categorie: 'Music' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
    it("should not create when no participants number is provided", async () => {
        var today = new Date();
        const response = await request(app).post('/events')
            .send({ title: 'Participantless Event', date: today.toISOString().split('T')[0], categorie: 'Music', lieu: 'Paris' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
    it("should not create when negative participants number is provided", async () => {
        var today = new Date();
        const response = await request(app).post('/events')
            .send({ title: 'Negative Participants Event', date: today.toISOString().split('T')[0], participants: -5, categorie: 'Music', lieu: 'Paris' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });


    it("should delete an existing event", async () => {
        const deleteResponse = await request(app).delete("/events/" + eventId);
        expect(deleteResponse.statusCode).toBe(204);
    });
    it("should not delete a non-existing event", async () => {
        const deleteResponse = await request(app).delete("/events/" + eventId);
        expect(deleteResponse.statusCode).toBe(404);
    });

});
describe('Health Check', () => {
  it('GET /health devrait retourner 200 avec status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('GET /health devrait contenir env et version', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('env');
    expect(response.body).toHaveProperty('version');
  });
});
