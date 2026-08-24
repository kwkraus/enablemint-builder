namespace EnableFront.Builder.Features.Sessions.Dtos;

public record SessionResponseDto(
    Guid SessionId,
    Guid SeriesId,
    string Title,
    DateTime StartsAt,
    DateTime EndsAt,
    string? RegistrationUrl = null,
    string? Description = null);