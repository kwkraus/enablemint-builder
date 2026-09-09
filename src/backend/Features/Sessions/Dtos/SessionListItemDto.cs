namespace EnableFront.Builder.Features.Sessions.Dtos;

public record SessionListItemDto(
    Guid SessionId,
    string Title,
    DateTime StartsAt,
    DateTime EndsAt,
    int TotalRegistrations,
    int TotalAttendees,
    string OwnerDisplayName,
    string? RegistrationUrl = null,
    string? RecordingUrl = null);