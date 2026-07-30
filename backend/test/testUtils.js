function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
    download: jest.fn(function download(file) {
      this.downloadedFile = file;
      return this;
    }),
    setHeader: jest.fn(function setHeader(name, value) {
      this.headers[name] = value;
      return this;
    }),
    end: jest.fn(),
  };
}

function createRequest({ body = {}, params = {}, query = {}, usuario = { idLogin: 1, nivel: "admin" }, file } = {}) {
  return { body, params, query, usuario, file };
}

module.exports = { createResponse, createRequest };
