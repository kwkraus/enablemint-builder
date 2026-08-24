namespace EnableFront.Builder.Features.Series.Dtos;

public record SeriesResponseDto(
    Guid SeriesId,
    string Title,
    string? Details,
    bool IsPublic,
    string? ImageUrl,
    DateTime CreatedAt,
    DateTime UpdatedAt);