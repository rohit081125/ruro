package com.videocall.controller;

import com.videocall.auth.service.TokenService;
import com.videocall.service.RoomService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final TokenService tokenService;

    public RoomController(RoomService roomService, TokenService tokenService) {
        this.roomService = roomService;
        this.tokenService = tokenService;
    }

    @PostMapping("/create")
    public Map<String, String> createRoom(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        tokenService.getUserIdFromBearerToken(authorizationHeader);
        String code = roomService.createRoom();
        return Map.of("roomCode", code);
    }

    @GetMapping("/check/{code}")
    public Map<String, Boolean> checkRoom(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable String code
    ) {
        tokenService.getUserIdFromBearerToken(authorizationHeader);
        return Map.of("exists", roomService.roomExists(code));
    }
}
