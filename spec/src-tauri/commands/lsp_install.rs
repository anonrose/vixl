use std::fs;
use std::io::{Cursor, Write};
use std::time::{SystemTime, UNIX_EPOCH};

use app_lib::commands::lsp_install::{
    extract_archive_bytes, extract_tar_xz_bytes, extract_zip_bytes,
};
use tar::{Builder, Header};
use xz2::write::XzEncoder;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

fn temp_dir(label: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("vixl-lsp-install-{label}-{nanos}"));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn tar_xz_bytes(path: &str, contents: &[u8], mode: u32) -> Vec<u8> {
    let mut tar_buf = Vec::new();
    {
        let mut tar = Builder::new(&mut tar_buf);
        let mut header = Header::new_gnu();
        header.set_size(contents.len() as u64);
        header.set_mode(mode);
        header.set_cksum();
        tar.append_data(&mut header, path, contents).unwrap();
        tar.finish().unwrap();
    }
    let mut encoded = Vec::new();
    {
        let mut encoder = XzEncoder::new(&mut encoded, 6);
        encoder.write_all(&tar_buf).unwrap();
        encoder.finish().unwrap();
    }
    encoded
}

fn zip_bytes(path: &str, contents: &[u8], unix_mode: u32) -> Vec<u8> {
    let cursor = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(unix_mode);
    writer.start_file(path, options).unwrap();
    writer.write_all(contents).unwrap();
    writer.finish().unwrap().into_inner()
}

#[test]
fn extract_tar_xz_bytes_unpacks_nested_file() {
    let dest = temp_dir("tar-xz");
    let bytes = tar_xz_bytes("bin/tool", b"xz-payload\n", 0o755);
    extract_tar_xz_bytes(&bytes, &dest).unwrap();
    let extracted = dest.join("bin").join("tool");
    assert_eq!(fs::read(&extracted).unwrap(), b"xz-payload\n");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(&extracted).unwrap().permissions().mode();
        assert_eq!(mode & 0o111, 0o111);
    }
    let _ = fs::remove_dir_all(&dest);
}

#[test]
fn extract_zip_bytes_unpacks_nested_file() {
    let dest = temp_dir("zip");
    let bytes = zip_bytes("bin/tool", b"zip-payload\n", 0o755);
    extract_zip_bytes(&bytes, &dest).unwrap();
    let extracted = dest.join("bin").join("tool");
    assert_eq!(fs::read(&extracted).unwrap(), b"zip-payload\n");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(&extracted).unwrap().permissions().mode();
        assert_eq!(mode & 0o111, 0o111);
    }
    let _ = fs::remove_dir_all(&dest);
}

#[test]
fn extract_archive_bytes_dispatches_tar_xz_and_zip() {
    let xz_dest = temp_dir("dispatch-xz");
    let xz_bytes = tar_xz_bytes("from-xz", b"a", 0o644);
    extract_archive_bytes(&xz_bytes, "https://example.com/pkg.tar.xz", &xz_dest).unwrap();
    assert_eq!(fs::read(xz_dest.join("from-xz")).unwrap(), b"a");

    let zip_dest = temp_dir("dispatch-zip");
    let z_bytes = zip_bytes("from-zip", b"b", 0o644);
    extract_archive_bytes(&z_bytes, "https://example.com/pkg.zip", &zip_dest).unwrap();
    assert_eq!(fs::read(zip_dest.join("from-zip")).unwrap(), b"b");

    let _ = fs::remove_dir_all(&xz_dest);
    let _ = fs::remove_dir_all(&zip_dest);
}
