namespace EnableFront.Builder.Features.Series.Dtos;

/// <summary>
/// <paramref name="IsPublic"/> is nullable so an older client that omits the field leaves the
/// series' current stored visibility unchanged rather than silently resetting it to <c>false</c>.
/// </summary>
public record UpdateSeriesRequest(string Title, string? Details = null, bool? IsPublic = null);