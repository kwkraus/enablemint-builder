namespace EnableFront.Builder.Features.Sessions.Dtos;

public record CreateSessionRequest(
    string Title,
    DateTime StartsAt,
    DateTime EndsAt,
    string? RegistrationUrl = null,
    string? Description = null);