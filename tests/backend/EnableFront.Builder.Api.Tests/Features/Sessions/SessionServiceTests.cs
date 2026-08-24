using EnableFront.Builder.Domain.Entities;
using EnableFront.Builder.Features.Sessions;
using EnableFront.Builder.Features.Sessions.Dtos;
using EnableFront.Builder.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace EnableFront.Builder.Api.Tests.Features.Sessions;

public class SessionServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly SessionService _sut;
    private const string OwnerUserId = "user-oid-123";
    private const string OtherUserId = "other-user-oid-456";

    public SessionServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .EnableServiceProviderCaching(false)
            .Options;
        _db = new AppDbContext(options);
        _sut = new SessionService(_db);
    }

    public void Dispose() => _db.Dispose();

    // ---------- CreateAsync ----------

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenEndsAtNotAfterStartsAt()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var req = new CreateSessionRequest(
            "Bad Times",
            StartsAt: DateTime.UtcNow.AddHours(2),
            EndsAt: DateTime.UtcNow.AddHours(1));  // EndsAt before StartsAt

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("invalid_time_range");
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenEndsAtEqualsStartsAt()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var when = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest("Zero Duration", when, when);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("invalid_time_range");
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenSeriesDoesNotExist()
    {
        // Act — use a random series ID that has no matching row
        var req = new CreateSessionRequest(
            "Orphan Session",
            DateTime.UtcNow.AddHours(1),
            DateTime.UtcNow.AddHours(2));

        var (session, errorCode) = await _sut.CreateAsync(Guid.NewGuid(), req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("series_not_found");
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenSeriesBelongsToDifferentOwner()
    {
        // Arrange — series owned by another user
        var series = BuildSeries(ownerOverride: OtherUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var req = new CreateSessionRequest(
            "Cross-owner",
            DateTime.UtcNow.AddHours(1),
            DateTime.UtcNow.AddHours(2));

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("series_not_found");
    }

    [Fact]
    public async Task CreateAsync_CreatesSession()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var endsAt = startsAt.AddHours(1);
        var req = new CreateSessionRequest("Valid Session", startsAt, endsAt);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session.Should().NotBeNull();
        session!.SeriesId.Should().Be(series.SeriesId);
        session.Title.Should().Be("Valid Session");
    }

    // ---------- GetBySeriesAsync ----------

    [Fact]
    public async Task GetBySeriesAsync_ReturnsEmptyList_ForUnknownSeries()
    {
        // Act
        var result = (await _sut.GetBySeriesAsync(Guid.NewGuid(), OwnerUserId)).ToList();

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetBySeriesAsync_ReturnsOnlySessionsForSeries()
    {
        // Arrange
        var series1 = BuildSeries();
        var series2 = BuildSeries();
        _db.Series.AddRange(series1, series2);
        _db.Sessions.AddRange(
            BuildSession(series1.SeriesId),
            BuildSession(series1.SeriesId),
            BuildSession(series2.SeriesId));
        await _db.SaveChangesAsync();

        // Act
        var result = (await _sut.GetBySeriesAsync(series1.SeriesId, OwnerUserId)).ToList();

        // Assert
        result.Should().HaveCount(2);
    }

    // ---------- GetByIdAsync ----------

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(session.SessionId, OtherUserId);

        // Assert
        result.Should().BeNull();
    }

    // ---------- DeleteAsync ----------

    [Fact]
    public async Task DeleteAsync_RemovesSession_ReturnsTrue()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.DeleteAsync(session.SessionId, OwnerUserId);

        // Assert
        result.Should().BeTrue();
        var saved = await _db.Sessions.FindAsync(session.SessionId);
        saved.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_ForNonExistentSession()
    {
        var result = await _sut.DeleteAsync(Guid.NewGuid(), OwnerUserId);
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.DeleteAsync(session.SessionId, OtherUserId);

        // Assert
        result.Should().BeFalse();
        (await _db.Sessions.FindAsync(session.SessionId)).Should().NotBeNull("session should not be deleted by wrong owner");
    }

    [Fact]
    public async Task DeleteAsync_DeletesSession_WhenLastInSeries()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);

        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.DeleteAsync(session.SessionId, OwnerUserId);

        // Assert
        result.Should().BeTrue();
        (await _db.Sessions.FindAsync(session.SessionId)).Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_DeletesSession_WhenOtherSessionsRemain()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);

        var session1 = BuildSession(series.SeriesId);
        var session2 = BuildSession(series.SeriesId);
        _db.Sessions.AddRange(session1, session2);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.DeleteAsync(session1.SessionId, OwnerUserId);

        // Assert
        result.Should().BeTrue();
        (await _db.Sessions.FindAsync(session1.SessionId)).Should().BeNull();
        (await _db.Sessions.FindAsync(session2.SessionId)).Should().NotBeNull("remaining session should not be deleted");
    }

    // ---------- UpdateAsync ----------

    [Fact]
    public async Task UpdateAsync_UpdatesAllFields()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var newStart = DateTime.UtcNow.AddDays(5);
        var newEnd = newStart.AddHours(2);
        var req = new UpdateSessionRequest("New Title", newStart, newEnd);

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        result.Should().NotBeNull();
        result!.Title.Should().Be("New Title");
        result.StartsAt.Should().BeCloseTo(newStart, TimeSpan.FromSeconds(1));
        result.EndsAt.Should().BeCloseTo(newEnd, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task UpdateAsync_ReturnsError_WhenEndsAtNotAfterStartsAt()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var when = DateTime.UtcNow.AddDays(1);
        var req = new UpdateSessionRequest("Title", when, when.AddHours(-1));

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        result.Should().BeNull();
        errorCode.Should().Be("invalid_time_range");
    }

    [Fact]
    public async Task UpdateAsync_ReturnsError_WhenSessionNotFound()
    {
        var req = new UpdateSessionRequest("Title", DateTime.UtcNow, DateTime.UtcNow.AddHours(1));
        var (result, errorCode) = await _sut.UpdateAsync(Guid.NewGuid(), req, OwnerUserId);

        result.Should().BeNull();
        errorCode.Should().Be("session_not_found");
    }

    [Fact]
    public async Task UpdateAsync_ReturnsError_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var req = new UpdateSessionRequest("Hack", DateTime.UtcNow, DateTime.UtcNow.AddHours(1));

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OtherUserId);

        // Assert
        result.Should().BeNull();
        errorCode.Should().Be("session_not_found");
    }

    [Fact]
    public async Task UpdateTitleAsync_UpdatesOnlyTitle()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        var originalStartsAt = session.StartsAt;
        var originalEndsAt = session.EndsAt;
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var req = new UpdateSessionTitleRequest("Renamed Session");

        // Act
        var (result, errorCode) = await _sut.UpdateTitleAsync(session.SessionId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        result.Should().NotBeNull();
        result!.Title.Should().Be("Renamed Session");
        result.StartsAt.Should().BeCloseTo(originalStartsAt, TimeSpan.FromSeconds(1));
        result.EndsAt.Should().BeCloseTo(originalEndsAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task UpdateTitleAsync_UpdatesTitle()
    {
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var req = new UpdateSessionTitleRequest("Renamed");

        var (result, errorCode) = await _sut.UpdateTitleAsync(
            session.SessionId,
            req,
            OwnerUserId);

        errorCode.Should().BeNull();
        result.Should().NotBeNull();
        result!.Title.Should().Be("Renamed");
    }

    [Fact]
    public async Task UpdateTitleAsync_ReturnsError_WhenSessionNotFound()
    {
        var req = new UpdateSessionTitleRequest("Title");

        var (result, errorCode) = await _sut.UpdateTitleAsync(Guid.NewGuid(), req, OwnerUserId);

        result.Should().BeNull();
        errorCode.Should().Be("session_not_found");
    }

    [Fact]
    public async Task UpdateTitleAsync_ReturnsError_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var req = new UpdateSessionTitleRequest("Hack");

        // Act
        var (result, errorCode) = await _sut.UpdateTitleAsync(session.SessionId, req, OtherUserId);

        // Assert
        result.Should().BeNull();
        errorCode.Should().Be("session_not_found");
    }

    // ---------- GetByIdAsync (success) ----------

    [Fact]
    public async Task GetByIdAsync_ReturnsSession_WithCorrectFields()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(session.SessionId, OwnerUserId);

        // Assert
        result.Should().NotBeNull();
        result!.SessionId.Should().Be(session.SessionId);
        result.SeriesId.Should().Be(series.SeriesId);
        result.Title.Should().Be("Test Session");
    }

    // ---------- RegistrationUrl (create) ----------

    [Fact]
    public async Task CreateAsync_PersistsRegistrationUrl_WhenValid()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest(
            "With Link", startsAt, startsAt.AddHours(1),
            "https://teams.microsoft.com/registration/example");

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session.Should().NotBeNull();
        session!.RegistrationUrl.Should().Be("https://teams.microsoft.com/registration/example");
    }

    [Fact]
    public async Task CreateAsync_LeavesRegistrationUrlNull_WhenOmitted()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest("No Link", startsAt, startsAt.AddHours(1));

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session.Should().NotBeNull();
        session!.RegistrationUrl.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_TrimsSurroundingWhitespace_FromRegistrationUrl()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest(
            "Padded Link", startsAt, startsAt.AddHours(1),
            "   https://zoom.us/webinar/register   ");

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session!.RegistrationUrl.Should().Be("https://zoom.us/webinar/register");
    }

    [Fact]
    public async Task CreateAsync_TreatsWhitespaceOnlyRegistrationUrl_AsNull()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest("Whitespace Link", startsAt, startsAt.AddHours(1), "   ");

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session!.RegistrationUrl.Should().BeNull();
    }

    [Theory]
    [InlineData("example.com/register")] // bare domain, no scheme
    [InlineData("/register")] // relative path
    [InlineData("not a url")] // malformed
    [InlineData("javascript:alert(1)")] // non-web scheme
    [InlineData("file:///etc/passwd")] // non-web scheme
    public async Task CreateAsync_RejectsInvalidRegistrationUrl(string invalidUrl)
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest("Invalid Link", startsAt, startsAt.AddHours(1), invalidUrl);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("invalid_registration_url");
        (await _db.Sessions.AnyAsync()).Should().BeFalse("no session should be persisted when the URL is invalid");
    }

    [Fact]
    public async Task CreateAsync_RejectsRegistrationUrl_WhenLongerThanMaxLength()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var overlong = "https://example.com/" + new string('a', RegistrationUrlValidator.MaxLength);
        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest("Overlong Link", startsAt, startsAt.AddHours(1), overlong);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("registration_url_too_long");
    }

    // ---------- RegistrationUrl (update) ----------

    [Fact]
    public async Task UpdateAsync_ReplacesRegistrationUrl_WhenValid()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.RegistrationUrl = "https://teams.microsoft.com/registration/old";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var newStart = DateTime.UtcNow.AddDays(2);
        var req = new UpdateSessionRequest(
            "Title", newStart, newStart.AddHours(1),
            "https://zoom.us/webinar/register/new");

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        result!.RegistrationUrl.Should().Be("https://zoom.us/webinar/register/new");
    }

    [Fact]
    public async Task UpdateAsync_ClearsRegistrationUrl_WhenEmptyValueSupplied()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.RegistrationUrl = "https://teams.microsoft.com/registration/old";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var newStart = DateTime.UtcNow.AddDays(2);
        var req = new UpdateSessionRequest("Title", newStart, newStart.AddHours(1), "");

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        result!.RegistrationUrl.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_LeavesRegistrationUrlUnchanged_WhenUpdateRejectedForInvalidUrl()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.RegistrationUrl = "https://teams.microsoft.com/registration/original";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var newStart = DateTime.UtcNow.AddDays(2);
        var req = new UpdateSessionRequest("New Title", newStart, newStart.AddHours(1), "javascript:alert(1)");

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        result.Should().BeNull();
        errorCode.Should().Be("invalid_registration_url");

        var unchanged = await _db.Sessions.FindAsync(session.SessionId);
        unchanged!.Title.Should().Be("Test Session", "an invalid registration URL must reject the entire save");
        unchanged.RegistrationUrl.Should().Be("https://teams.microsoft.com/registration/original");
    }

    // ---------- RegistrationUrl (read) ----------

    [Fact]
    public async Task GetByIdAsync_ReturnsRegistrationUrl()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.RegistrationUrl = "https://webex.com/register/example";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(session.SessionId, OwnerUserId);

        // Assert
        result!.RegistrationUrl.Should().Be("https://webex.com/register/example");
    }

    [Fact]
    public async Task GetBySeriesAsync_IncludesRegistrationUrl_InListItems()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var withLink = BuildSession(series.SeriesId);
        withLink.RegistrationUrl = "https://teams.microsoft.com/registration/example";
        var withoutLink = BuildSession(series.SeriesId);
        _db.Sessions.AddRange(withLink, withoutLink);
        await _db.SaveChangesAsync();

        // Act
        var result = (await _sut.GetBySeriesAsync(series.SeriesId, OwnerUserId)).ToList();

        // Assert
        result.Single(s => s.SessionId == withLink.SessionId).RegistrationUrl
            .Should().Be("https://teams.microsoft.com/registration/example");
        result.Single(s => s.SessionId == withoutLink.SessionId).RegistrationUrl
            .Should().BeNull();
    }



    // ---------- Description: sanitized persistence (specs/003-session-description) ----------

    [Fact]
    public async Task CreateAsync_SanitizesDescription_BeforePersisting()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest(
            "Described Session", startsAt, startsAt.AddHours(1),
            RegistrationUrl: null,
            Description: "<p><b>Bold</b> outcome</p><a href=\"https://example.com\">link text</a>");

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session!.Description.Should().Be("<p><strong>Bold</strong> outcome</p>link text");

        var saved = await _db.Sessions.FindAsync(session.SessionId);
        saved!.Description.Should().Be("<p><strong>Bold</strong> outcome</p>link text");
    }

    [Fact]
    public async Task CreateAsync_LeavesDescriptionNull_WhenOmitted()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest("No Description Session", startsAt, startsAt.AddHours(1));

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session!.Description.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("<p></p>")]
    public async Task CreateAsync_TreatsBlankOrWhitespaceOnlyDescription_AsNull(string blankDescription)
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest(
            "Blank Description Session", startsAt, startsAt.AddHours(1),
            RegistrationUrl: null, Description: blankDescription);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session!.Description.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_Accepts_ExactlyMaxLengthDescription()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var text = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength);
        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest(
            "Max Length Description Session", startsAt, startsAt.AddHours(1),
            RegistrationUrl: null, Description: text);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        session!.Description.Should().Be(text);
    }

    [Fact]
    public async Task CreateAsync_Rejects_OneOverMaxLengthDescription_AndPersistsNothing()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var text = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength + 1);
        var startsAt = DateTime.UtcNow.AddHours(1);
        var req = new CreateSessionRequest(
            "Too Long Description Session", startsAt, startsAt.AddHours(1),
            RegistrationUrl: null, Description: text);

        // Act
        var (session, errorCode) = await _sut.CreateAsync(series.SeriesId, req, OwnerUserId);

        // Assert
        session.Should().BeNull();
        errorCode.Should().Be("validation_error");
        (await _db.Sessions.AnyAsync(s => s.Title == "Too Long Description Session")).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_SanitizesDescription_BeforePersisting()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var newStart = DateTime.UtcNow.AddDays(3);
        var req = new UpdateSessionRequest(
            "Title", newStart, newStart.AddHours(1),
            RegistrationUrl: null, Description: "<ul><li>One</li><li><i>Two</i></li></ul>");

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        result!.Description.Should().Be("<ul><li>One</li><li><em>Two</em></li></ul>");

        var saved = await _db.Sessions.FindAsync(session.SessionId);
        saved!.Description.Should().Be("<ul><li>One</li><li><em>Two</em></li></ul>");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("<p></p>")]
    public async Task UpdateAsync_ClearsDescription_ToNull_WhenBlankOrWhitespaceProvided(string blankDescription)
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.Description = "<p>Existing description</p>";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var newStart = DateTime.UtcNow.AddDays(3);
        var req = new UpdateSessionRequest(
            "Title", newStart, newStart.AddHours(1),
            RegistrationUrl: null, Description: blankDescription);

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        errorCode.Should().BeNull();
        result!.Description.Should().BeNull();

        var saved = await _db.Sessions.FindAsync(session.SessionId);
        saved!.Description.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_Rejects_OneOverMaxLengthDescription_AndPersistsNoPartialUpdate()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.Description = "<p>Original description</p>";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var text = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength + 1);
        var newStart = DateTime.UtcNow.AddDays(3);
        var req = new UpdateSessionRequest(
            "Changed Title", newStart, newStart.AddHours(1),
            RegistrationUrl: null, Description: text);

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OwnerUserId);

        // Assert
        result.Should().BeNull();
        errorCode.Should().Be("validation_error");

        var saved = await _db.Sessions.FindAsync(session.SessionId);
        saved!.Title.Should().Be("Test Session", "no partial update should be persisted when validation fails");
        saved.Description.Should().Be("<p>Original description</p>");
        saved.StartsAt.Should().NotBe(newStart, "the rejected schedule change must not be persisted either");
    }

    [Fact]
    public async Task UpdateAsync_ReturnsError_ForWrongOwner_EvenWhenDescriptionProvided()
    {
        // Arrange — an attacker (wrong owner) cannot alter another owner's session description.
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.Description = "<p>Owner's original description</p>";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        var req = new UpdateSessionRequest(
            "Hack", DateTime.UtcNow, DateTime.UtcNow.AddHours(1),
            RegistrationUrl: null, Description: "<p>Hacked description</p>");

        // Act
        var (result, errorCode) = await _sut.UpdateAsync(session.SessionId, req, OtherUserId);

        // Assert
        result.Should().BeNull();
        errorCode.Should().Be("session_not_found");

        var saved = await _db.Sessions.FindAsync(session.SessionId);
        saved!.Description.Should().Be("<p>Owner's original description</p>");
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsSanitizedDescription_ForCorrectOwner()
    {
        // Arrange
        var series = BuildSeries();
        _db.Series.Add(series);
        var session = BuildSession(series.SeriesId);
        session.Description = "<p><strong>Already sanitized</strong></p>";
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(session.SessionId, OwnerUserId);

        // Assert
        result!.Description.Should().Be("<p><strong>Already sanitized</strong></p>");
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNullDescription_ForLegacySessionCreatedBeforeFeature()
    {
        // Arrange — simulates a pre-existing row where Description was never set (defaults to null),
        // proving backward compatibility for sessions created before this feature (FR-005/edge cases).
        var series = BuildSeries();
        _db.Series.Add(series);
        var legacySession = BuildSession(series.SeriesId);
        _db.Sessions.Add(legacySession);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(legacySession.SessionId, OwnerUserId);

        // Assert
        result!.Description.Should().BeNull();
    }

    [Fact]
    public async Task TwoSessions_InSameSeries_NeverShareOrLeakEachOthersDescription()
    {
        // Arrange — FR-007: one session's description must never appear on a different session.
        var series = BuildSeries();
        _db.Series.Add(series);
        var sessionA = BuildSession(series.SeriesId);
        sessionA.Description = "<p>Session A description</p>";
        var sessionB = BuildSession(series.SeriesId);
        sessionB.Description = "<p>Session B description</p>";
        _db.Sessions.AddRange(sessionA, sessionB);
        await _db.SaveChangesAsync();

        // Act
        var resultA = await _sut.GetByIdAsync(sessionA.SessionId, OwnerUserId);
        var resultB = await _sut.GetByIdAsync(sessionB.SessionId, OwnerUserId);

        // Assert
        resultA!.Description.Should().Be("<p>Session A description</p>");
        resultB!.Description.Should().Be("<p>Session B description</p>");
    }

    // ---------- Helpers ----------

    private EnableFront.Builder.Domain.Entities.Series BuildSeries(string? ownerOverride = null) =>
        new()
        {
            SeriesId = Guid.NewGuid(),
            OwnerUserId = ownerOverride ?? OwnerUserId,
            Title = "Test Series " + Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

    private Session BuildSession(Guid seriesId) =>
        new()
        {
            SessionId = Guid.NewGuid(),
            SeriesId = seriesId,
            OwnerUserId = OwnerUserId,
            Title = "Test Session",
            StartsAt = DateTime.UtcNow.AddDays(1),
            EndsAt = DateTime.UtcNow.AddDays(1).AddHours(1)
        };
}
