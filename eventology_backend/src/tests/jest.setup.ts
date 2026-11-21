// Global Jest setup: ensure local test servers (127.0.0.1 / localhost) are not routed through external sandbox proxies
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
delete process.env.HTTPS_PROXY;
delete process.env.https_proxy;
delete process.env.ALL_PROXY;
delete process.env.all_proxy;
delete process.env.grpc_proxy;
delete process.env.GRPC_PROXY;

process.env.NO_PROXY = "localhost,127.0.0.1,::1";
process.env.no_proxy = "localhost,127.0.0.1,::1";

