using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EnableFront.Builder.Common;
using EnableFront.Builder.Features.Series.Dtos;
using EnableFront.Builder.Features.Series.Public.Dtos;
using FluentAssertions;

namespace EnableFront.Builder.Api.Tests.Features.Series.Public;

/// <summary>
/// API contract tests for the anonymous public series landing page endpoint
/// (<c>GET /api/v1/public/series/{id}</c>), exercised end-to-end through the real minimal API
/// pipeline via <see cref="SeriesApiWebApplicationFactory"/>. See
/// specs/004-public-series-landing-page/contracts/public-series-api.md.
/// </summary>
public sealed class PublicSeriesEndpointsTests : IDisposable
{
    private const string OwnerOid = "public-contract-owner-oid";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly SeriesApiWebApplicationFactory _factory = new();
    private readonly HttpClient _ownerClient;
    private readonly HttpClient _anonymousClient;

    public PublicSeriesEndpointsTests()
    {
        _ownerClient = _factory.CreateClient();
        _ownerClient.DefaultRequestHeaders.Add(TestAuthHandler.OidHeaderName, OwnerOid);
        _anonymousClient = _factory.CreateClient();
    }

    public void Dispose()
    {
        _ownerClient.Dispose();
        _anonymousClient.Dispose();
        _factory.Dispose();
    }

    [Fact]
    public async Task Get_ReturnsOk_WithTitleDetailsAndSessions_WhenSeriesIsPublic()
    {
        var series = await CreatePublicSeriesAsync("Public Series", "<p>Details</p>");
        await CreateSessionAsync(series.SeriesId, "Session 1", "https://example.com/register");

        var response = await _anonymousClient.GetAsync($"/api/v1/public/series/{series.SeriesId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PublicSeriesResponseDto>(JsonOptions);
        body!.Title.Should().Be("Public Series");
        body.Details.Should().Be("<p>Details</p>");
        body.Sessions.Should().ContainSingle(s => s.Title == "Session 1" && s.RegistrationUrl == "https://example.com/register");
    }

    [Fact]
    public async Task Get_ReturnsNotFound_WithSeriesNotFoundShape_WhenSeriesIsPrivate()
    {
        var series = await CreatePrivateSeriesAsync("Private Series");

        var response = await _anonymousClient.GetAsync($"/api/v1/public/series/{series.SeriesId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var error = await response.Content.ReadFromJsonAsync<ErrorEnvelope>(JsonOptions);
        error!.ErrorCode.Should().Be("series_not_found");
    }

    [Fact]
    public async Task Get_ReturnsNotFound_WithIdenticalShape_WhenSeriesDoesNotExist()
    {
        var response = await _anonymousClient.GetAsync($"/api/v1/public/series/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var error = await response.Content.ReadFromJsonAsync<ErrorEnvelope>(JsonOptions);
        error!.ErrorCode.Should().Be("series_not_found");
    }

    [Fact]
    public async Task Get_ResponseBody_NeverContainsOwnerOrSeriesIdOrIsPublicOrMetricsFields()
    {
        var series = await CreatePublicSeriesAsync("Public Series", null);

        var response = await _anonymousClient.GetAsync($"/api/v1/public/series/{series.SeriesId}");
        var rawJson = await response.Content.ReadAsStringAsync();

        rawJson.Should().NotContainEquivalentOf("ownerUserId");
        rawJson.Should().NotContainEquivalentOf("seriesId");
        rawJson.Should().NotContainEquivalentOf("isPublic");
        rawJson.Should().NotContainEquivalentOf("totalRegistrations");
        rawJson.Should().NotContainEquivalentOf("totalAttendees");
    }

    [Fact]
    public async Task Get_IsReachable_WithNoAuthorizationHeaderOrCookie()
    {
        var series = await CreatePublicSeriesAsync("Public Series", null);

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/public/series/{series.SeriesId}");
        using var response = await _anonymousClient.SendAsync(request);

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Get_ReturnsNullDetails_AndEmptySessions_ForMinimalPublicSeries()
    {
        var series = await CreatePublicSeriesAsync("Minimal Series", null);

        var response = await _anonymousClient.GetAsync($"/api/v1/public/series/{series.SeriesId}");
        var body = await response.Content.ReadFromJsonAsync<PublicSeriesResponseDto>(JsonOptions);

        body!.Details.Should().BeNull();
        body.Sessions.Should().BeEmpty();
    }

    [Fact]
    public async Task Get_IncludesSessionsWithNoRegistrationUrl_AsNullRegistrationUrl()
    {
        var series = await CreatePublicSeriesAsync("Public Series", null);
        await CreateSessionAsync(series.SeriesId, "No Registration Session", registrationUrl: null);

        var response = await _anonymousClient.GetAsync($"/api/v1/public/series/{series.SeriesId}");
        var body = await response.Content.ReadFromJsonAsync<PublicSeriesResponseDto>(JsonOptions);

        body!.Sessions.Should().ContainSingle(s => s.Title == "No Registration Session" && s.RegistrationUrl == null);
    }

    // ---------- Helpers ----------

    private async Task<SeriesResponseDto> CreatePublicSeriesAsync(string title, string? details)
    {
        var created = await CreateSeriesAsync(title, details);
        var putResponse = await _ownerClient.PutAsJsonAsync(
            $"/api/v1/series/{created.SeriesId}", new UpdateSeriesRequest(title, details, IsPublic: true));
        putResponse.EnsureSuccessStatusCode();
        return (await putResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions))!;
    }

    private async Task<SeriesResponseDto> CreatePrivateSeriesAsync(string title) =>
        await CreateSeriesAsync(title, null);

    private async Task<SeriesResponseDto> CreateSeriesAsync(string title, string? details)
    {
        var response = await _ownerClient.PostAsJsonAsync("/api/v1/series", new CreateSeriesRequest(title, details));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions))!;
    }

    private async Task CreateSessionAsync(Guid seriesId, string title, string? registrationUrl)
    {
        var response = await _ownerClient.PostAsJsonAsync(
            $"/api/v1/series/{seriesId}/sessions",
            new
            {
                Title = title,
                StartsAt = DateTime.UtcNow.AddDays(1),
                EndsAt = DateTime.UtcNow.AddDays(1).AddHours(1),
                RegistrationUrl = registrationUrl
            });
        response.EnsureSuccessStatusCode();
    }
}
