namespace EnableFront.Builder.Features.Series.Public.Dtos;

/// <summary>
/// Anonymous, read-only projection of a session within a public series landing page.
/// Excludes <c>OwnerUserId</c> and any metrics fields.
/// </summary>
public record PublicSessionDto(
    Guid SessionId,
    string Title,
    DateTime StartsAt,
    DateTime EndsAt,
    string? RegistrationUrl,
    string? Description);
