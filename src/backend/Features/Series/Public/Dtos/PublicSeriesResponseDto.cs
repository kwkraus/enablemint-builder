namespace EnableFront.Builder.Features.Series.Public.Dtos;

/// <summary>
/// Anonymous, read-only projection of a public series. Deliberately excludes
/// <c>SeriesId</c>, <c>OwnerUserId</c>, <c>IsPublic</c>, and any metrics — see
/// specs/004-public-series-landing-page/contracts/public-series-api.md.
/// </summary>
public record PublicSeriesResponseDto(
    string Title,
    string? Details,
    string? ImageUrl,
    IReadOnlyList<PublicSessionDto> Sessions);
