using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EnableFront.Builder.Common;
using EnableFront.Builder.Features.Series.Dtos;
using FluentAssertions;

namespace EnableFront.Builder.Api.Tests.Features.Series;

/// <summary>
/// API contract tests for the Series Details field, exercised end-to-end through the real minimal
/// API pipeline (routing, model binding, authorization, and JSON serialization) via
/// <see cref="SeriesApiWebApplicationFactory"/>. Complements <c>SeriesServiceTests</c>, which covers
/// persistence/sanitization logic directly against <c>SeriesService</c>.
/// </summary>
public sealed class SeriesDetailsApiContractTests : IDisposable
{
    private const string OwnerOid = "contract-owner-oid";
    private const string OtherOid = "contract-other-oid";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly SeriesApiWebApplicationFactory _factory = new();
    private readonly HttpClient _ownerClient;

    public SeriesDetailsApiContractTests()
    {
        _ownerClient = _factory.CreateClient();
        _ownerClient.DefaultRequestHeaders.Add(TestAuthHandler.OidHeaderName, OwnerOid);
    }

    public void Dispose()
    {
        _ownerClient.Dispose();
        _factory.Dispose();
    }

    [Fact]
    public async Task Post_ThenGet_RoundTripsSanitizedDetails()
    {
        var createResponse = await _ownerClient.PostAsJsonAsync(
            "/api/v1/series",
            new CreateSeriesRequest("Contract Series", "<p><b>Bold</b></p><a href=\"https://example.com\">link text</a>"));

        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        created!.Details.Should().Be("<p><strong>Bold</strong></p>link text");

        var getResponse = await _ownerClient.GetAsync($"/api/v1/series/{created.SeriesId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var fetched = await getResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        fetched!.Details.Should().Be("<p><strong>Bold</strong></p>link text");
    }

    [Fact]
    public async Task Post_LeavesDetailsNull_WhenOmitted()
    {
        var createResponse = await _ownerClient.PostAsJsonAsync(
            "/api/v1/series", new CreateSeriesRequest("No Details Series"));

        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        created!.Details.Should().BeNull();
    }

    [Fact]
    public async Task Put_ClearsDetailsToNull_WhenBlankProvided()
    {
        var created = await CreateSeriesAsync("Clearable Series", "<p>Some details</p>");

        var putResponse = await _ownerClient.PutAsJsonAsync(
            $"/api/v1/series/{created.SeriesId}", new UpdateSeriesRequest(created.Title, "   "));

        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await putResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        updated!.Details.Should().BeNull();

        var getResponse = await _ownerClient.GetAsync($"/api/v1/series/{created.SeriesId}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        fetched!.Details.Should().BeNull();
    }

    [Fact]
    public async Task Put_RejectsOverLengthDetails_WithValidationErrorAndNoPartialUpdate()
    {
        var created = await CreateSeriesAsync("Original Title", "<p>Original details</p>");
        var tooLong = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength + 1);

        var putResponse = await _ownerClient.PutAsJsonAsync(
            $"/api/v1/series/{created.SeriesId}", new UpdateSeriesRequest("Changed Title", tooLong));

        putResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await putResponse.Content.ReadFromJsonAsync<ErrorEnvelope>(JsonOptions);
        error!.ErrorCode.Should().Be("validation_error");
        error.Message.Should().NotBeNullOrWhiteSpace();

        var getResponse = await _ownerClient.GetAsync($"/api/v1/series/{created.SeriesId}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        fetched!.Title.Should().Be("Original Title", "no partial update should be persisted when validation fails");
        fetched.Details.Should().Be("<p>Original details</p>");
    }

    [Fact]
    public async Task Post_RejectsOverLengthDetails_WithValidationError()
    {
        var tooLong = new string('a', EnableFront.Builder.Common.SeriesDetailsSanitizer.MaxPlainTextLength + 1);

        var createResponse = await _ownerClient.PostAsJsonAsync(
            "/api/v1/series", new CreateSeriesRequest("Too Long Series", tooLong));

        createResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await createResponse.Content.ReadFromJsonAsync<ErrorEnvelope>(JsonOptions);
        error!.ErrorCode.Should().Be("validation_error");
    }

    [Fact]
    public async Task Get_ReturnsUnauthorized_WhenNoOidHeaderPresent()
    {
        using var anonymousClient = _factory.CreateClient();

        var response = await anonymousClient.GetAsync("/api/v1/series");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_ReturnsNotFound_ForNonOwner_SoDetailsAreNotLeakedAcrossOwners()
    {
        var created = await CreateSeriesAsync("Owner Only Series", "<p>Private details</p>");

        using var otherClient = _factory.CreateClient();
        otherClient.DefaultRequestHeaders.Add(TestAuthHandler.OidHeaderName, OtherOid);

        var response = await otherClient.GetAsync($"/api/v1/series/{created.SeriesId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_ReturnsIsPublic_InResponseBody()
    {
        var created = await CreateSeriesAsync("Visibility Series", null);

        var getResponse = await _ownerClient.GetAsync($"/api/v1/series/{created.SeriesId}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);

        fetched!.IsPublic.Should().BeFalse();
    }

    [Fact]
    public async Task Put_PersistsIsPublic_AndReturnsItInResponseBody()
    {
        var created = await CreateSeriesAsync("Visibility Series", null);

        var putResponse = await _ownerClient.PutAsJsonAsync(
            $"/api/v1/series/{created.SeriesId}", new UpdateSeriesRequest(created.Title, IsPublic: true));

        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await putResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        updated!.IsPublic.Should().BeTrue();
    }

    [Fact]
    public async Task Put_ReturnsNotFound_ForNonOwner_SoIsPublicCannotBeChangedByOthers()
    {
        var created = await CreateSeriesAsync("Owner Only Series", null);

        using var otherClient = _factory.CreateClient();
        otherClient.DefaultRequestHeaders.Add(TestAuthHandler.OidHeaderName, OtherOid);

        var response = await otherClient.PutAsJsonAsync(
            $"/api/v1/series/{created.SeriesId}", new UpdateSeriesRequest(created.Title, IsPublic: true));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var getResponse = await _ownerClient.GetAsync($"/api/v1/series/{created.SeriesId}");
        var fetched = await getResponse.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions);
        fetched!.IsPublic.Should().BeFalse("a non-owner PUT must not change visibility");
    }

    private async Task<SeriesResponseDto> CreateSeriesAsync(string title, string? details)
    {
        var response = await _ownerClient.PostAsJsonAsync("/api/v1/series", new CreateSeriesRequest(title, details));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SeriesResponseDto>(JsonOptions))!;
    }
}
