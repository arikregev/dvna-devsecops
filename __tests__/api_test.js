var request = require("supertest");
var app = require("../src/server.js");

describe("GET /unit-test", function () {
  it("respond with hello world", async function (done) {
    const response = await request(app).get("/unit-test");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello World!");
    done();
  });

  it("respond with hello world 2", async function (done) {
    const response = await request(app).get("/unit-test");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello World!");
    done();
  });
});
