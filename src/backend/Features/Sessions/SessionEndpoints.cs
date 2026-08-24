using EnableFront.Builder.Common;
using EnableFront.Builder.Common.Extensions;
using EnableFront.Builder.Features.Sessions.Dtos;

namespace EnableFront.Builder.Features.Sessions;

public static class SessionEndpoints
{
    public static WebApplication MapSessionEndpoints(this WebApplication app)
    {
        // Sessions nested under series
        app.MapGet("/api/v1/series/{id:guid}/sessions",
            async (Guid id, SessionService service, HttpContext ctx) =>
            {
                var userId = ctx.GetUserOid();
                if (userId is null)
                    return Results.Unauthorized();

                var displayName = ctx.GetUserDisplayName();
                var result = await service.GetBySeriesAsync(id, userId, displayName);
                return Results.Ok(result);
            })
            .RequireAuthorization();

        app.MapPost("/api/v1/series/{id:guid}/sessions",
            async (Guid id, CreateSessionRequest req, SessionService service, HttpContext ctx) =>
            {
                var userId = ctx.GetUserOid();
                if (userId is null)
                    return Results.Unauthorized();

                if (string.IsNullOrWhiteSpace(req.Title))
                    return Results.BadRequest(new ErrorEnvelope(
                        "validation_error", "Title is required.", ctx.TraceIdentifier));

                var (session, errorCode) = await service.CreateAsync(id, req, userId);
                if (session is null)
                {
                    if (errorCode == "series_not_found")
                        return Results.NotFound(new ErrorEnvelope(
                            "series_not_found", "Series not found.", ctx.TraceIdentifier));

                    return Results.BadRequest(new ErrorEnvelope(
                        errorCode ?? "invalid_request",
                        SessionErrorMessage(errorCode) ?? "EndsAt must be after StartsAt.",
                        ctx.TraceIdentifier));
                }

                return Results.Created($"/api/v1/sessions/{session.SessionId}", session);
            })
            .RequireAuthorization();

        // Sessions direct access
        var sessionGroup = app.MapGroup("/api/v1/sessions").RequireAuthorization();

        sessionGroup.MapGet("/{id:guid}", async (Guid id, SessionService service, HttpContext ctx) =>
        {
            var userId = ctx.GetUserOid();
            if (userId is null)
                return Results.Unauthorized();

            var result = await service.GetByIdAsync(id, userId);
            if (result is null)
                return Results.NotFound(new ErrorEnvelope(
                    "session_not_found", "Session not found.", ctx.TraceIdentifier));

            return Results.Ok(result);
        });

        sessionGroup.MapPut("/{id:guid}", async (Guid id, UpdateSessionRequest req, SessionService service, HttpContext ctx) =>
        {
            var userId = ctx.GetUserOid();
            if (userId is null)
                return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest(new ErrorEnvelope(
                    "validation_error", "Title is required.", ctx.TraceIdentifier));

            var (session, errorCode) = await service.UpdateAsync(id, req, userId);
            if (session is null)
            {
                if (errorCode == "session_not_found")
                    return Results.NotFound(new ErrorEnvelope(
                        "session_not_found", "Session not found.", ctx.TraceIdentifier));

                return Results.BadRequest(new ErrorEnvelope(
                    errorCode ?? "invalid_time_range",
                    SessionErrorMessage(errorCode) ?? "EndsAt must be after StartsAt.",
                    ctx.TraceIdentifier));
            }

            return Results.Ok(session);
        });

        sessionGroup.MapPut("/{id:guid}/title", async (Guid id, UpdateSessionTitleRequest req, SessionService service, HttpContext ctx) =>
        {
            var userId = ctx.GetUserOid();
            if (userId is null)
                return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest(new ErrorEnvelope(
                    "validation_error", "Title is required.", ctx.TraceIdentifier));

            var (session, errorCode) = await service.UpdateTitleAsync(id, req, userId);
            if (session is null)
            {
                return Results.NotFound(new ErrorEnvelope(
                    errorCode ?? "session_not_found", "Session not found.", ctx.TraceIdentifier));
            }

            return Results.Ok(session);
        });

        sessionGroup.MapDelete("/{id:guid}", async (Guid id, SessionService service, HttpContext ctx) =>
        {
            var userId = ctx.GetUserOid();
            if (userId is null)
                return Results.Unauthorized();

            var deleted = await service.DeleteAsync(id, userId);
            return deleted
                ? Results.NoContent()
                : Results.NotFound(new ErrorEnvelope(
                    "session_not_found", "Session not found.", ctx.TraceIdentifier));
        });

        return app;
    }

    /// <summary>
    /// Maps a <see cref="SessionService"/> validation error code to a message identifying the
    /// affected field. Covers <see cref="RegistrationUrlValidator"/> errors and the shared
    /// description-too-long validation error (see
    /// specs/003-session-description/contracts/session-description-api.md), returning
    /// <see langword="null"/> for any other/unrecognized code.
    /// </summary>
    private static string? SessionErrorMessage(string? errorCode) => errorCode switch
    {
        RegistrationUrlValidator.TooLongErrorCode =>
            $"registrationUrl must be {RegistrationUrlValidator.MaxLength} characters or fewer.",
        RegistrationUrlValidator.InvalidErrorCode =>
            "registrationUrl must be a well-formed absolute http:// or https:// URL.",
        "validation_error" =>
            $"Session description must not exceed {SeriesDetailsSanitizer.MaxPlainTextLength:N0} characters.",
        _ => null
    };
}