namespace EnableFront.Builder.Domain.Entities;

public class Session
{
    public Guid SessionId { get; set; }
    public Guid SeriesId { get; set; }
    public string OwnerUserId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string? RegistrationUrl { get; set; }

    /// <summary>
    /// Optional absolute http/https URL of the published recording for this session. When set,
    /// the public series landing page surfaces a recording link; the registration link is only
    /// shown alongside it while the session has not yet been delivered.
    /// <see langword="null"/> means no recording is available.
    /// </summary>
    public string? RecordingUrl { get; set; }

    /// <summary>
    /// Optional sanitized rich-text description for this individual session. Scoped to the
    /// session itself: it is never inherited from <see cref="Series.Details"/> and does not fall
    /// back to any other session's description. <see langword="null"/> means no description has
    /// been saved. See specs/003-session-description/data-model.md.
    /// </summary>
    public string? Description { get; set; }
}