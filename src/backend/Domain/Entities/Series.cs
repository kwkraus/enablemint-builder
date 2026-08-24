namespace EnableFront.Builder.Domain.Entities;

public class Series
{
    public Guid SeriesId { get; set; }
    public string OwnerUserId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Details { get; set; }

    /// <summary>
    /// Gates the anonymous public landing page (see specs/004-public-series-landing-page).
    /// Defaults to <see langword="false"/> for every new and existing series; only the owner can
    /// toggle it via the same update path used for <see cref="Title"/>/<see cref="Details"/>.
    /// </summary>
    public bool IsPublic { get; set; } = false;

    /// <summary>
    /// Optional custom banner image URL for the public landing page. <see langword="null"/> means
    /// no custom image has been set, in which case the public page renders a bundled stock banner.
    /// Reserved for a future owner-facing image upload/URL editor; today it can only be seeded
    /// directly (no API surface sets it yet).
    /// </summary>
    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}