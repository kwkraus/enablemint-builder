using EnableFront.Builder.Common;

namespace EnableFront.Builder.Features.Series.Public;

/// <summary>
/// Anonymous read-only endpoint group for the public series landing page. Deliberately kept
/// separate from <see cref="EnableFront.Builder.Features.Series.SeriesEndpoints"/> — this group
/// has no <c>.RequireAuthorization()</c> call so it can never accidentally weaken the existing
/// authenticated group's protection. See specs/004-public-series-landing-page/research.md
/// Decision 2.
/// </summary>
public static class PublicSeriesEndpoints
{
    public static WebApplication MapPublicSeriesEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/public/series");

        group.MapGet("/{id:guid}", async (Guid id, PublicSeriesService service, HttpContext ctx) =>
        {
            var result = await service.GetPublicSeriesAsync(id);
            return result is null
                ? Results.NotFound(new ErrorEnvelope(
                    "series_not_found", "Series not found.", ctx.TraceIdentifier))
                : Results.Ok(result);
        });

        return app;
    }
}
