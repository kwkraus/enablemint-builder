using EnableFront.Builder.Common;
using EnableFront.Builder.Domain.Entities;
using EnableFront.Builder.Features.Sessions.Dtos;
using EnableFront.Builder.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EnableFront.Builder.Features.Sessions;

public class SessionService
{
    private readonly AppDbContext _db;

    public SessionService(AppDbContext db, ILogger<SessionService>? logger = null)
    {
        _db = db;
    }

    public async Task<IEnumerable<SessionListItemDto>> GetBySeriesAsync(Guid seriesId, string ownerUserId, string ownerDisplayName = "")
    {
        var sessions = await _db.Sessions
            .Where(s => s.SeriesId == seriesId && s.OwnerUserId == ownerUserId)
            .OrderBy(s => s.StartsAt)
            .ToListAsync();

        var sessionIds = sessions.Select(s => s.SessionId).ToList();

        var metrics = await _db.SessionMetrics
            .Where(m => sessionIds.Contains(m.SessionId))
            .ToDictionaryAsync(m => m.SessionId);

        return sessions.Select(s =>
        {
            var m = metrics.TryGetValue(s.SessionId, out var sm) ? sm : null;

            return new SessionListItemDto(
                s.SessionId,
                s.Title,
                s.StartsAt,
                s.EndsAt,
                m?.TotalRegistrations ?? 0,
                m?.TotalAttendees ?? 0,
                ownerDisplayName,
                s.RegistrationUrl);
        });
    }

    public async Task<SessionResponseDto?> GetByIdAsync(Guid sessionId, string ownerUserId)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.OwnerUserId == ownerUserId);
        if (session is null) return null;

        return ToResponseDto(session);
    }

    public async Task<(SessionResponseDto? session, string? errorCode)> CreateAsync(
        Guid seriesId, CreateSessionRequest req, string ownerUserId)
    {
        if (req.EndsAt <= req.StartsAt)
            return (null, "invalid_time_range");

        var (registrationUrl, registrationUrlErrorCode) = RegistrationUrlValidator.Normalize(req.RegistrationUrl);
        if (registrationUrlErrorCode is not null)
            return (null, registrationUrlErrorCode);

        // Sanitize (and validate the length of) the description before any entity mutation, so a
        // rejected create never persists partial content. The sanitizer is the shared, server-side
        // authority also used by SeriesService (see src/backend/Common/SeriesDetailsSanitizer.cs).
        var descriptionResult = SeriesDetailsSanitizer.Sanitize(req.Description);
        if (descriptionResult.ExceedsMaxLength)
            return (null, "validation_error");

        var seriesExists = await _db.Series
            .AnyAsync(s => s.SeriesId == seriesId && s.OwnerUserId == ownerUserId);
        if (!seriesExists)
            return (null, "series_not_found");

        var session = new Session
        {
            SessionId = Guid.NewGuid(),
            SeriesId = seriesId,
            OwnerUserId = ownerUserId,
            Title = req.Title,
            StartsAt = req.StartsAt.Kind == DateTimeKind.Utc ? req.StartsAt : req.StartsAt.ToUniversalTime(),
            EndsAt = req.EndsAt.Kind == DateTimeKind.Utc ? req.EndsAt : req.EndsAt.ToUniversalTime(),
            RegistrationUrl = registrationUrl,
            Description = descriptionResult.SanitizedHtml
        };

        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();
        return (ToResponseDto(session), null);
    }

    public async Task<(SessionResponseDto? session, string? errorCode)> UpdateAsync(
        Guid sessionId, UpdateSessionRequest req, string ownerUserId)
    {
        if (req.EndsAt <= req.StartsAt)
            return (null, "invalid_time_range");

        var (registrationUrl, registrationUrlErrorCode) = RegistrationUrlValidator.Normalize(req.RegistrationUrl);
        if (registrationUrlErrorCode is not null)
            return (null, registrationUrlErrorCode);

        // Sanitize before loading/mutating the session so a rejected update leaves the
        // previously-saved title, schedule, registration URL, and description untouched.
        var descriptionResult = SeriesDetailsSanitizer.Sanitize(req.Description);
        if (descriptionResult.ExceedsMaxLength)
            return (null, "validation_error");

        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.OwnerUserId == ownerUserId);
        if (session is null)
            return (null, "session_not_found");

        session.Title = req.Title;
        session.StartsAt = req.StartsAt.Kind == DateTimeKind.Utc ? req.StartsAt : req.StartsAt.ToUniversalTime();
        session.EndsAt = req.EndsAt.Kind == DateTimeKind.Utc ? req.EndsAt : req.EndsAt.ToUniversalTime();
        session.RegistrationUrl = registrationUrl;
        session.Description = descriptionResult.SanitizedHtml;

        await _db.SaveChangesAsync();

        return (ToResponseDto(session), null);
    }

    public async Task<(SessionResponseDto? session, string? errorCode)> UpdateTitleAsync(
        Guid sessionId, UpdateSessionTitleRequest req, string ownerUserId)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.OwnerUserId == ownerUserId);
        if (session is null)
            return (null, "session_not_found");

        session.Title = req.Title;

        await _db.SaveChangesAsync();

        return (ToResponseDto(session), null);
    }

    public async Task<bool> DeleteAsync(Guid sessionId, string ownerUserId)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.OwnerUserId == ownerUserId);
        if (session is null) return false;

        _db.Sessions.Remove(session);

        await _db.SaveChangesAsync();
        return true;
    }

    // --- Helpers ---

    private static SessionResponseDto ToResponseDto(Session s) =>
        new(s.SessionId, s.SeriesId, s.Title, s.StartsAt, s.EndsAt, s.RegistrationUrl, s.Description);
}