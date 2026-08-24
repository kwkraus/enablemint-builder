using EnableFront.Builder.Common;
using EnableFront.Builder.Features.Series.Dtos;
using EnableFront.Builder.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EnableFront.Builder.Features.Series;

public class SeriesService
{
    private readonly AppDbContext _db;
    private readonly ILogger<SeriesService>? _logger;

    public SeriesService(AppDbContext db, ILogger<SeriesService>? logger = null)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IEnumerable<SeriesListItemDto>> GetAllAsync(string ownerUserId)
    {
        var series = await _db.Series
            .Where(s => s.OwnerUserId == ownerUserId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var seriesIds = series.Select(s => s.SeriesId).ToList();

        var metrics = await _db.SeriesMetrics
            .Where(m => seriesIds.Contains(m.SeriesId))
            .ToDictionaryAsync(m => m.SeriesId);

        var sessionCounts = await _db.Sessions
            .Where(s => seriesIds.Contains(s.SeriesId))
            .GroupBy(s => s.SeriesId)
            .Select(g => new { SeriesId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SeriesId, x => x.Count);

        return series.Select(s =>
        {
            var m = metrics.TryGetValue(s.SeriesId, out var sm) ? sm : null;
            return new SeriesListItemDto(
                s.SeriesId,
                s.Title,
                sessionCounts.TryGetValue(s.SeriesId, out var count) ? count : 0,
                m?.TotalRegistrations ?? 0,
                m?.TotalAttendees ?? 0,
                m?.UniqueAccountsInfluenced ?? 0,
                s.CreatedAt,
                s.UpdatedAt);
        });
    }

    public async Task<SeriesResponseDto?> GetByIdAsync(Guid id, string ownerUserId)
    {
        var series = await _db.Series
            .FirstOrDefaultAsync(s => s.SeriesId == id && s.OwnerUserId == ownerUserId);
        if (series is null) return null;

        return ToResponseDto(series);
    }

    public async Task<SeriesResponseDto> CreateAsync(CreateSeriesRequest req, string ownerUserId)
    {
        var sanitizedDetails = SanitizeDetailsOrThrow(req.Details);

        var series = new Domain.Entities.Series
        {
            SeriesId = Guid.NewGuid(),
            OwnerUserId = ownerUserId,
            Title = req.Title,
            Details = sanitizedDetails,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Series.Add(series);
        await _db.SaveChangesAsync();
        return ToResponseDto(series);
    }

    public async Task<SeriesResponseDto?> UpdateAsync(Guid id, UpdateSeriesRequest req, string ownerUserId)
    {
        var series = await _db.Series
            .FirstOrDefaultAsync(s => s.SeriesId == id && s.OwnerUserId == ownerUserId);
        if (series is null) return null;

        // Validate before mutating anything so a rejected update never persists partial content.
        var sanitizedDetails = SanitizeDetailsOrThrow(req.Details);

        var previousIsPublic = series.IsPublic;

        series.Title = req.Title;
        series.Details = sanitizedDetails;
        // Null means the client omitted the field: preserve the current stored value rather than
        // silently resetting visibility to false on an unrelated save.
        series.IsPublic = req.IsPublic ?? series.IsPublic;
        series.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (series.IsPublic != previousIsPublic)
        {
            _logger?.LogInformation(
                "Series {SeriesId} public visibility changed from {PreviousIsPublic} to {IsPublic}",
                series.SeriesId, previousIsPublic, series.IsPublic);
        }

        return ToResponseDto(series);
    }

    public async Task<bool> DeleteAsync(Guid id, string ownerUserId)
    {
        var series = await _db.Series
            .FirstOrDefaultAsync(s => s.SeriesId == id && s.OwnerUserId == ownerUserId);
        if (series is null) return false;

        _db.Series.Remove(series);
        await _db.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Sanitizes raw series details HTML down to the allow-listed subset and enforces the
    /// maximum decoded plain-text length. Throws <see cref="SeriesDetailsTooLongException"/>
    /// without mutating any state when the limit is exceeded.
    /// </summary>
    private static string? SanitizeDetailsOrThrow(string? rawDetails)
    {
        var result = SeriesDetailsSanitizer.Sanitize(rawDetails);
        if (result.ExceedsMaxLength)
            throw new SeriesDetailsTooLongException(
                $"Series details must not exceed {SeriesDetailsSanitizer.MaxPlainTextLength:N0} characters.");

        return result.SanitizedHtml;
    }

    private static SeriesResponseDto ToResponseDto(Domain.Entities.Series s) =>
        new(s.SeriesId, s.Title, s.Details, s.IsPublic, s.ImageUrl, s.CreatedAt, s.UpdatedAt);
}