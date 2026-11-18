
export default {
  fetch(request: Request): Response {
    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "GET" } }
      );
    }

    return Response.json({
      success: true,
      message: "CampusQueue API is running",
      version: "0.0.1",
    });
  },
};
