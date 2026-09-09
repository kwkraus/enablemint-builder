namespace EnableFront.Builder.Features.Sessions;

/// <summary>
/// Normalizes and validates the optional session recording URL.
/// </summary>
/// <remarks>
/// Applies the same shape-only, provider-agnostic rules as
/// <see cref="RegistrationUrlValidator"/> (trim, empty means "no recording URL",
/// max length, absolute <c>http</c>/<c>https</c> only) but reports its own stable
/// error codes so callers can identify which field was rejected.
/// </remarks>
public static class RecordingUrlValidator
{
    /// <summary>Maximum allowed length of a trimmed recording URL, in characters.</summary>
    public const int MaxLength = RegistrationUrlValidator.MaxLength;

    /// <summary>Stable error code returned when the trimmed value exceeds <see cref="MaxLength"/>.</summary>
    public const string TooLongErrorCode = "recording_url_too_long";

    /// <summary>
    /// Stable error code returned when the trimmed value is not an absolute
    /// <c>http</c>/<c>https</c> URL.
    /// </summary>
    public const string InvalidErrorCode = "invalid_recording_url";

    /// <summary>
    /// Normalizes and validates <paramref name="rawValue"/>.
    /// </summary>
    /// <returns>
    /// A tuple where <c>Value</c> is the trimmed URL to persist (or <see langword="null"/>
    /// when the input was empty/whitespace-only), and <c>ErrorCode</c> is <see langword="null"/>
    /// on success or one of the stable error codes above when validation fails.
    /// </returns>
    public static (string? Value, string? ErrorCode) Normalize(string? rawValue)
    {
        var (value, errorCode) = RegistrationUrlValidator.Normalize(rawValue);

        return errorCode switch
        {
            RegistrationUrlValidator.TooLongErrorCode => (null, TooLongErrorCode),
            RegistrationUrlValidator.InvalidErrorCode => (null, InvalidErrorCode),
            _ => (value, null)
        };
    }
}
