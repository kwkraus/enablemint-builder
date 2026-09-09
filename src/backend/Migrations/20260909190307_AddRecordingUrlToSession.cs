using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnableFront.Builder.Migrations
{
    /// <inheritdoc />
    public partial class AddRecordingUrlToSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecordingUrl",
                table: "Sessions",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecordingUrl",
                table: "Sessions");
        }
    }
}
