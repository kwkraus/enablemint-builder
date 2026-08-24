using EnableFront.Builder.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace EnableFront.Builder.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Series> Series => Set<Series>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<NormalizedRegistration> NormalizedRegistrations => Set<NormalizedRegistration>();
    public DbSet<NormalizedAttendance> NormalizedAttendances => Set<NormalizedAttendance>();
    public DbSet<SessionMetrics> SessionMetrics => Set<SessionMetrics>();
    public DbSet<SeriesMetrics> SeriesMetrics => Set<SeriesMetrics>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var utcConverter = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableUtcConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v.Value : v.Value.ToUniversalTime()) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        // "nvarchar(max)" is SQL Server-specific syntax; SQLite's column-type parser rejects the
        // non-numeric "max" argument, so only apply it when actually targeting SQL Server. This
        // keeps production (SQL Server) behavior unchanged while allowing an in-memory SQLite
        // provider to be used for WebApplicationFactory-based API contract tests.
        var isSqlServer = Database.IsSqlServer();

        // --- Series ---
        modelBuilder.Entity<Series>(e =>
        {
            e.HasKey(x => x.SeriesId);
            e.Property(x => x.SeriesId).ValueGeneratedNever();
            e.Property(x => x.CreatedAt).HasColumnType("datetime2").HasConversion(utcConverter);
            e.Property(x => x.UpdatedAt).HasColumnType("datetime2").HasConversion(utcConverter);
            var detailsProperty = e.Property(x => x.Details);
            if (isSqlServer) detailsProperty.HasColumnType("nvarchar(max)");
            e.HasIndex(x => new { x.OwnerUserId, x.Title }).IsUnique();
            e.HasIndex(x => new { x.OwnerUserId, x.CreatedAt });
        });

        // --- Session ---
        modelBuilder.Entity<Session>(e =>
        {
            e.HasKey(x => x.SessionId);
            e.Property(x => x.SessionId).ValueGeneratedNever();
            e.Property(x => x.StartsAt).HasColumnType("datetime2").HasConversion(utcConverter);
            e.Property(x => x.EndsAt).HasColumnType("datetime2").HasConversion(utcConverter);
            e.Property(x => x.RegistrationUrl).HasMaxLength(2048);
            var descriptionProperty = e.Property(x => x.Description);
            if (isSqlServer) descriptionProperty.HasColumnType("nvarchar(max)");
            e.HasOne<Series>().WithMany().HasForeignKey(x => x.SeriesId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.SeriesId, x.StartsAt });
        });

        // --- NormalizedRegistration ---
        modelBuilder.Entity<NormalizedRegistration>(e =>
        {
            e.HasKey(x => x.RegistrationId);
            e.Property(x => x.RegistrationId).ValueGeneratedNever();
            e.Property(x => x.RegisteredAt).HasColumnType("datetime2").HasConversion(utcConverter);
            e.HasIndex(x => new { x.OwnerUserId, x.SessionId, x.Email }).IsUnique();
            e.HasIndex(x => new { x.SessionId, x.EmailDomain });
            e.HasOne<Session>().WithMany().HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        // --- NormalizedAttendance ---
        modelBuilder.Entity<NormalizedAttendance>(e =>
        {
            e.HasKey(x => x.AttendanceId);
            e.Property(x => x.AttendanceId).ValueGeneratedNever();
            e.Property(x => x.FirstJoinAt).HasColumnType("datetime2").HasConversion(nullableUtcConverter);
            e.Property(x => x.LastLeaveAt).HasColumnType("datetime2").HasConversion(nullableUtcConverter);
            e.HasIndex(x => new { x.OwnerUserId, x.SessionId, x.Email }).IsUnique();
            e.HasIndex(x => new { x.SessionId, x.EmailDomain });
            e.HasOne<Session>().WithMany().HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        // --- SessionMetrics ---
        var warmAccountsTriggeredConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());

        modelBuilder.Entity<SessionMetrics>(e =>
        {
            e.HasKey(x => x.SessionId);
            e.Property(x => x.SessionId).ValueGeneratedNever();
            var warmAccountsTriggeredProperty = e.Property(x => x.WarmAccountsTriggered)
                .HasConversion(warmAccountsTriggeredConverter);
            if (isSqlServer) warmAccountsTriggeredProperty.HasColumnType("nvarchar(max)");
            e.HasOne<Session>().WithOne().HasForeignKey<SessionMetrics>(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        // --- SeriesMetrics ---
        var warmAccountsConverter = new ValueConverter<List<WarmAccountEntry>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<WarmAccountEntry>>(v, (JsonSerializerOptions?)null) ?? new List<WarmAccountEntry>());

        modelBuilder.Entity<SeriesMetrics>(e =>
        {
            e.HasKey(x => x.SeriesId);
            e.Property(x => x.SeriesId).ValueGeneratedNever();
            var warmAccountsProperty = e.Property(x => x.WarmAccounts)
                .HasConversion(warmAccountsConverter);
            if (isSqlServer) warmAccountsProperty.HasColumnType("nvarchar(max)");
            e.HasOne<Series>().WithOne().HasForeignKey<SeriesMetrics>(x => x.SeriesId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
