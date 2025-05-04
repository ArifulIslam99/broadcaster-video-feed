module file_storage::file_storage{
    use std::string::{String};

    public struct FileStorage has key {
        id: UID,
        file_ids: vector<String>,
    }

     public struct FILE_STORAGE has drop {}
    fun init(_otw: FILE_STORAGE, ctx: &mut TxContext) {
        let file_storage = FileStorage {
            id: object::new(ctx),
            file_ids: vector::empty<String>(),
        };
        transfer::share_object(file_storage);
    }

    // Add a new file_id to storage
    public entry fun add_file_id(storage: &mut FileStorage, file_id: String) {
        vector::push_back(&mut storage.file_ids, file_id);
    }

    // Get all stored file_ids (read-only)
    public fun get_file_ids(storage: &FileStorage): vector<String> {
        storage.file_ids
    }

     // Remove a file_id from storage
    public entry fun remove_file_id(storage: &mut FileStorage, file_id: String) {
        let len = vector::length(&storage.file_ids);
        let mut i = 0;
        while (i < len) {
            let current = vector::borrow(&storage.file_ids, i);
            if (current == &file_id) {
                vector::remove(&mut storage.file_ids, i);
                return
            };
            i = i + 1;
        };
    }
}


