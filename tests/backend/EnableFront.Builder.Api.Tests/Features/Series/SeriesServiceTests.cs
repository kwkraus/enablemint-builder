using EnableFront.Builder.Domain.Entities;
using EnableFront.Builder.Features.Series;
using EnableFront.Builder.Features.Series.Dtos;
using EnableFront.Builder.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace EnableFront.Builder.Api.Tests.Features.Series;

public class SeriesServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly SeriesService _sut;
    private const string OwnerUserId = "user-oid-123";
    private const string OtherUserId = "other-user-oid-456";

    public SeriesServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .EnableServiceProviderCaching(false)
            .Options;
        _db = new AppDbContext(options);
        _sut = new SeriesService(_db);
    }

    public void Dispose() => _db.Dispose();

    // ---------- GetAllAsync ----------

    [Fact]
    public async Task GetAllAsync_ReturnsOnlySeriesOwnedByUser()
    {
        // Arrange
        _db.Series.AddRange(
            BuildSeries("Alpha", OwnerUserId),
            BuildSeries("Beta", OwnerUserId),
            BuildSeries("Gamma", OtherUserId));
        await _db.SaveChangesAsync();

        // Act
        var result = (await _sut.GetAllAsync(OwnerUserId)).ToList();

        // Assert
        result.Should().HaveCount(2);
        result.Select(s => s.Title).Should().BeEquivalentTo("Alpha", "Beta");
    }

    [Fact]
    public async Task GetAllAsync_ReturnsCorrectMetricsAndSessionCount()
    {
        // Arrange
        var series = BuildSeries("Alpha", OwnerUserId);
        _db.Series.Add(series);
        _db.Sessions.Add(BuildSession(series.SeriesId, OwnerUserId));
        _db.Sessions.Add(BuildSession(series.SeriesId, OwnerUserId));
        _db.SeriesMetrics.Add(new SeriesMetrics
        {
            SeriesId = series.SeriesId,
            TotalRegistrations = 10,
            TotalAttendees = 5,
            UniqueAccountsInfluenced = 3
        });
        await _db.SaveChangesAsync();

        // Act
        var result = (await _sut.GetAllAsync(OwnerUserId)).Single();

        // Assert
        result.SessionCount.Should().Be(2);
        result.TotalRegistrations.Should().Be(10);
        result.TotalAttendees.Should().Be(5);
        result.UniqueAccountsInfluenced.Should().Be(3);
    }

    // ---------- CreateAsync ----------

    [Fact]
    public async Task CreateAsync_CreatesSeries()
    {
        // Act
        var result = await _sut.CreateAsync(new CreateSeriesRequest("My Series"), OwnerUserId);

        // Assert
        result.Should().NotBeNull();
        result.Title.Should().Be("My Series");
        result.SeriesId.Should().NotBeEmpty();

        var saved = await _db.Series.FindAsync(result.SeriesId);
        saved.Should().NotBeNull();
        saved!.OwnerUserId.Should().Be(OwnerUserId);
    }

    [Fact]
    public async Task CreateAsync_SetsCreatedAtAndUpdatedAt_ToUtcNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var result = await _sut.CreateAsync(new CreateSeriesRequest("Timed Series"), OwnerUserId);

        // Assert
        result.CreatedAt.Should().BeAfter(before);
        result.UpdatedAt.Should().BeAfter(before);
    }

    // ---------- UpdateAsync ----------

    [Fact]
    public async Task UpdateAsync_UpdatesTitle()
    {
        // Arrange
        var series = BuildSeries("Old Title", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("New Title"), OwnerUserId);

        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("New Title");

        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.Title.Should().Be("New Title");
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries("Alpha", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("Hack"), OtherUserId);

        // Assert
        result.Should().BeNull();
    }

    // ---------- DeleteAsync ----------

    [Fact]
    public async Task DeleteAsync_RemovesSeries_ReturnsTrue()
    {
        // Arrange
        var series = BuildSeries("ToDelete", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.DeleteAsync(series.SeriesId, OwnerUserId);

        // Assert
        result.Should().BeTrue();
        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_WhenNotFound()
    {
        // Act
        var result = await _sut.DeleteAsync(Guid.NewGuid(), OwnerUserId);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries("Secret", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.DeleteAsync(series.SeriesId, OtherUserId);

        // Assert
        result.Should().BeFalse();
        (await _db.Series.FindAsync(series.SeriesId)).Should().NotBeNull("series should not be deleted by wrong owner");
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_ForNonExistentSeries()
    {
        var result = await _sut.UpdateAsync(Guid.NewGuid(), new UpdateSeriesRequest("Anything"), OwnerUserId);
        result.Should().BeNull();
    }

    // ---------- IsPublic (visibility toggle) ----------

    [Fact]
    public async Task CreateAsync_DefaultsIsPublic_ToFalse()
    {
        var result = await _sut.CreateAsync(new CreateSeriesRequest("New Series"), OwnerUserId);

        result.IsPublic.Should().BeFalse();

        var saved = await _db.Series.FindAsync(result.SeriesId);
        saved!.IsPublic.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_PersistsIsPublic_FalseToTrue()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(
            series.SeriesId, new UpdateSeriesRequest("Alpha", IsPublic: true), OwnerUserId);

        result!.IsPublic.Should().BeTrue();
        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.IsPublic.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateAsync_PersistsIsPublic_TrueToFalse()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        series.IsPublic = true;
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(
            series.SeriesId, new UpdateSeriesRequest("Alpha", IsPublic: false), OwnerUserId);

        result!.IsPublic.Should().BeFalse();
        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.IsPublic.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_PreservesStoredIsPublic_WhenRequestOmitsField()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        series.IsPublic = true;
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("Alpha Renamed"), OwnerUserId);

        result!.IsPublic.Should().BeTrue("omitting IsPublic on an unrelated save must not reset visibility");
        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.IsPublic.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateAsync_SetsUpdatedAt_AfterOriginalCreation()
    {
        // Arrange
        var series = BuildSeries("Original", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var originalUpdatedAt = series.UpdatedAt;
        await Task.Delay(10); // ensure time advances

        // Act
        var result = await _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("Changed"), OwnerUserId);

        // Assert
        result.Should().NotBeNull();
        result!.UpdatedAt.Should().BeOnOrAfter(originalUpdatedAt);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEmpty_WhenNoSeriesExist()
    {
        var result = (await _sut.GetAllAsync(OwnerUserId)).ToList();
        result.Should().BeEmpty();
    }

    // ---------- GetByIdAsync ----------

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_ForWrongOwner()
    {
        // Arrange
        var series = BuildSeries("Secret", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(series.SeriesId, OtherUserId);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsSeries_ForCorrectOwner()
    {
        // Arrange
        var series = BuildSeries("Visible", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetByIdAsync(series.SeriesId, OwnerUserId);

        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("Visible");
    }

    // ---------- Details: sanitized persistence ----------

    [Fact]
    public async Task CreateAsync_SanitizesDetails_BeforePersisting()
    {
        var result = await _sut.CreateAsync(
            new CreateSeriesRequest("Details Series", "<p><b>Bold</b> text</p>"), OwnerUserId);

        result.Details.Should().Be("<p><strong>Bold</strong> text</p>");

        var saved = await _db.Series.FindAsync(result.SeriesId);
        saved!.Details.Should().Be("<p><strong>Bold</strong> text</p>");
    }

    [Fact]
    public async Task CreateAsync_LeavesDetailsNull_WhenNotProvided()
    {
        var result = await _sut.CreateAsync(new CreateSeriesRequest("No Details Series"), OwnerUserId);

        result.Details.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_SanitizesDetails_BeforePersisting()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(
            series.SeriesId, new UpdateSeriesRequest("Alpha", "<ul><li>One</li><li><i>Two</i></li></ul>"), OwnerUserId);

        result!.Details.Should().Be("<ul><li>One</li><li><em>Two</em></li></ul>");

        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.Details.Should().Be("<ul><li>One</li><li><em>Two</em></li></ul>");
    }

    [Fact]
    public async Task UpdateAsync_AllowsOptionalEmptyDetails_OnSeriesWithNoExistingDetails()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("Alpha"), OwnerUserId);

        result!.Details.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("<p></p>")]
    public async Task UpdateAsync_ClearsDetails_ToNull_WhenBlankOrWhitespaceProvided(string blankDetails)
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        series.Details = "<p>Existing details</p>";
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("Alpha", blankDetails), OwnerUserId);

        result!.Details.Should().BeNull();

        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.Details.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_Accepts_ExactlyMaxLengthDetails()
    {
        var text = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength);

        var result = await _sut.CreateAsync(new CreateSeriesRequest("Max Length Series", text), OwnerUserId);

        result.Details.Should().Be(text);
    }

    [Fact]
    public async Task CreateAsync_Rejects_OneOverMaxLengthDetails_AndPersistsNothing()
    {
        var text = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength + 1);

        Func<Task> act = () => _sut.CreateAsync(new CreateSeriesRequest("Too Long Series", text), OwnerUserId);

        await act.Should().ThrowAsync<SeriesDetailsTooLongException>();
        (await _db.Series.AnyAsync(s => s.Title == "Too Long Series")).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_Rejects_OneOverMaxLengthDetails_AndPersistsNoPartialUpdate()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        series.Details = "<p>Original details</p>";
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var text = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength + 1);

        Func<Task> act = () => _sut.UpdateAsync(series.SeriesId, new UpdateSeriesRequest("Changed Title", text), OwnerUserId);

        await act.Should().ThrowAsync<SeriesDetailsTooLongException>();

        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.Title.Should().Be("Alpha", "no partial update should be persisted when validation fails");
        saved.Details.Should().Be("<p>Original details</p>");
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_ForWrongOwner_EvenWhenDetailsProvided()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.UpdateAsync(
            series.SeriesId, new UpdateSeriesRequest("Hack", "<p>Hacked details</p>"), OtherUserId);

        result.Should().BeNull();

        var saved = await _db.Series.FindAsync(series.SeriesId);
        saved!.Details.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsSanitizedDetails_ForCorrectOwner()
    {
        var series = BuildSeries("Alpha", OwnerUserId);
        series.Details = "<p><strong>Already sanitized</strong></p>";
        _db.Series.Add(series);
        await _db.SaveChangesAsync();

        var result = await _sut.GetByIdAsync(series.SeriesId, OwnerUserId);

        result!.Details.Should().Be("<p><strong>Already sanitized</strong></p>");
    }

    // ---------- Helpers ----------

    private static EnableFront.Builder.Domain.Entities.Series BuildSeries(string title, string owner) =>
        new()
        {
            SeriesId = Guid.NewGuid(),
            OwnerUserId = owner,
            Title = title,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

    private static Session BuildSession(Guid seriesId, string owner) =>
        new()
        {
            SessionId = Guid.NewGuid(),
            SeriesId = seriesId,
            OwnerUserId = owner,
            Title = "Session",
            StartsAt = DateTime.UtcNow.AddDays(1),
            EndsAt = DateTime.UtcNow.AddDays(1).AddHours(1)
        };
}
